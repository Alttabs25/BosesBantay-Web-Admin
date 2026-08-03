import { createContext, useContext, useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'
import { createClient } from '@supabase/supabase-js'

const AuthContext = createContext(null)

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// Secondary client that does not persist auth state in localStorage/sessionStorage.
// This allows the admin to register new accounts without being logged out.
const authAdminClient = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false
  }
})

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [accounts, setAccounts] = useState([])
  const [loading, setLoading] = useState(true)

  // Fetch all admin/staff accounts (users who are not 'Residente')
  const fetchAccounts = async () => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select(`
          id,
          first_name,
          last_name,
          email,
          roles (
            role_name
          )
        `)
      
      if (error) throw error

      if (data) {
        const mapped = data
          .filter(u => u.roles?.role_name !== 'Residente')
          .map(u => ({
            id: u.id,
            name: `${u.first_name} ${u.last_name}`.trim(),
            role: u.roles?.role_name || 'System Administrator',
            email: u.email,
            mustChangePassword: false,
          }))
        setAccounts(mapped)
      }
    } catch (err) {
      console.error('Error fetching admin accounts:', err)
    }
  }

  // Set up auth state listener
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (session?.user) {
        // Fetch matching profile details
        const { data: profile, error } = await supabase
          .from('users')
          .select('*, roles(role_name)')
          .eq('id', session.user.id)
          .single()

        if (!error && profile) {
          setUser({
            id: session.user.id,
            name: `${profile.first_name} ${profile.last_name}`.trim(),
            role: profile.roles?.role_name || 'System Administrator',
            email: session.user.email,
            avatarUrl: profile.avatar_url || null,
            mustChangePassword: session.user.user_metadata?.must_change_password || false,
          })
        } else {
          // Fallback if profile is not created yet
          setUser({
            id: session.user.id,
            name: session.user.user_metadata?.first_name || 'Admin User',
            role: 'System Administrator',
            email: session.user.email,
            mustChangePassword: session.user.user_metadata?.must_change_password || false,
          })
        }
        
        // Check if 2FA is globally disabled
        try {
          const { data: is2faDisabled } = await supabase.rpc('is_2fa_disabled')
          if (is2faDisabled) {
            sessionStorage.setItem('2fa_verified', 'true')
          }
        } catch (e) {
          console.error('Error checking 2fa disabled on refresh:', e)
        }

        fetchAccounts()
      } else {
        setUser(null)
        setAccounts([])
      }
      setLoading(false)
    })

    return () => {
      subscription?.unsubscribe()
    }
  }, [])

  const login = async ({ email, password }) => {
    const normalized = email.trim().toLowerCase()
    const { data, error } = await supabase.auth.signInWithPassword({
      email: normalized,
      password,
    })

    if (error) {
      return { success: false, error: error.message }
    }

    const { data: profile } = await supabase
      .from('users')
      .select('*, roles(role_name)')
      .eq('id', data.user.id)
      .single()

    const loggedInUser = {
      id: data.user.id,
      name: profile ? `${profile.first_name} ${profile.last_name}`.trim() : 'Admin User',
      role: profile?.roles?.role_name || 'System Administrator',
      email: data.user.email,
      avatarUrl: profile?.avatar_url || null,
      mustChangePassword: data.user.user_metadata?.must_change_password || false,
    }

    // Check if 2FA is globally disabled
    let is2faDisabled = false
    try {
      const { data: disabled } = await supabase.rpc('is_2fa_disabled')
      is2faDisabled = !!disabled
    } catch (e) {
      console.error('Error checking 2fa disabled on login:', e)
    }

    if (is2faDisabled) {
      sessionStorage.setItem('2fa_verified', 'true')
    } else {
      sessionStorage.removeItem('2fa_verified')
    }

    return { success: true, user: loggedInUser, is2faDisabled }
  }

  const logout = async () => {
    await supabase.auth.signOut()
    setUser(null)
  }

  const updateUser = async (partial) => {
    if (!user) return { success: false, error: 'Not authenticated' }

    let patch = {}
    if (partial.name) {
      const parts = partial.name.trim().split(' ')
      patch.first_name = parts[0]
      patch.last_name = parts.slice(1).join(' ')
    }
    if (partial.email) patch.email = partial.email
    if ('avatarUrl' in partial) patch.avatar_url = partial.avatarUrl

    const { error } = await supabase
      .from('users')
      .update(patch)
      .eq('id', user.id)

    if (error) {
      console.error('Error updating profile:', error)
      return { success: false, error: error.message }
    }

    setUser((prev) => (prev ? { ...prev, ...partial } : null))
    fetchAccounts()
    return { success: true }
  }

  const changePassword = async ({ currentPassword, newPassword }) => {
    if (!user) return { success: false, error: 'not-authenticated' }
    
    const { error } = await supabase.auth.updateUser({
      password: newPassword
    })

    if (error) {
      return { success: false, error: error.message }
    }
    return { success: true }
  }

  const completeFirstLogin = async (newPassword) => {
    if (!user) return { success: false }

    const { error } = await supabase.auth.updateUser({
      password: newPassword,
      data: { must_change_password: false }
    })

    if (error) {
      return { success: false, error: error.message }
    }

    setUser((prev) => (prev ? { ...prev, mustChangePassword: false } : null))
    return { success: true }
  }

  const createAdminAccount = async ({ name, email, role, tempPassword }) => {
    const parts = name.trim().split(' ')
    const first_name = parts[0] || 'Admin'
    const last_name = parts.slice(1).join(' ') || 'User'

    const { data, error } = await authAdminClient.auth.signUp({
      email: email.trim(),
      password: tempPassword,
      options: {
        data: {
          first_name,
          last_name,
          role,
          must_change_password: true
        }
      }
    })

    if (error) {
      return { success: false, error: error.message }
    }

    // Backup manual profile creation in case DB trigger is missing or disabled
    try {
      const { data: profile } = await authAdminClient
        .from('users')
        .select('id')
        .eq('id', data.user.id)
        .maybeSingle()

      if (!profile) {
        const { data: roleObj } = await authAdminClient
          .from('roles')
          .select('role_id')
          .eq('role_name', role)
          .maybeSingle()

        await authAdminClient.from('users').insert({
          id: data.user.id,
          role_id: roleObj?.role_id || null,
          first_name,
          last_name,
          email: email.trim(),
          address: 'N/A',
          barangay_id_image: 'N/A',
          verification_status: 'Pending',
          approval_status: 'Pending'
        })
      }
    } catch (e) {
      console.error('Manual admin profile backup insertion failed:', e)
    }

    const newAccount = {
      id: data.user.id,
      name: name.trim(),
      role,
      email: email.trim(),
      mustChangePassword: true,
    }

    setAccounts((prev) => [...prev, newAccount])
    return { success: true, account: newAccount }
  }

  const createResidentAccount = async ({ first_name, last_name, address, email, password }) => {
    const { data, error } = await authAdminClient.auth.signUp({
      email: email.trim(),
      password: password.trim(),
      options: {
        data: {
          first_name: first_name.trim(),
          last_name: last_name.trim(),
          address: address.trim(),
          role: 'Residente',
          must_change_password: false
        }
      }
    })

    if (error) {
      return { success: false, error: error.message }
    }

    // Backup manual profile creation in case DB trigger is missing or disabled
    try {
      const { data: profile } = await authAdminClient
        .from('users')
        .select('id')
        .eq('id', data.user.id)
        .maybeSingle()

      if (!profile) {
        const { data: roleObj } = await authAdminClient
          .from('roles')
          .select('role_id')
          .eq('role_name', 'Residente')
          .maybeSingle()

        await authAdminClient.from('users').insert({
          id: data.user.id,
          role_id: roleObj?.role_id || null,
          first_name: first_name.trim(),
          last_name: last_name.trim(),
          email: email.trim(),
          address: address.trim() || 'N/A',
          barangay_id_image: 'N/A',
          verification_status: 'Pending',
          approval_status: 'Pending'
        })
      }
    } catch (e) {
      console.error('Manual resident profile backup insertion failed:', e)
    }

    return { success: true, user: data?.user }
  }

  const resetAdminAccountPassword = async (accountId, newTempPassword) => {
    const target = accounts.find((a) => a.id === accountId)
    if (!target) return

    // Supabase native password recovery trigger
    await supabase.auth.resetPasswordForEmail(target.email, {
      redirectTo: `${window.location.origin}/reset-password`
    })
  }

  const deleteAdminAccount = async (accountId) => {
    // Delete profile in public schema. 
    // In production, cascade/trigger can handle full auth.users deletion or deactivation.
    const { error } = await supabase
      .from('users')
      .delete()
      .eq('id', accountId)

    if (!error) {
      setAccounts((prev) => prev.filter((a) => a.id !== accountId))
    }
  }

  // Trigger password reset email via native Supabase Auth
  const requestPasswordReset = async (email) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/reset-password`
    })

    if (error) {
      return { found: false }
    }
    return { found: true }
  }

  const resetPasswordWithCode = async ({ email, code, newPassword }) => {
    // Note: Supabase handles recovery code logic dynamically when navigating via reset link.
    // If using user-entered recovery code/pin:
    const { error } = await supabase.auth.updateUser({
      password: newPassword
    })

    if (error) return { success: false }
    return { success: true }
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        accounts,
        login,
        logout,
        updateUser,
        changePassword,
        completeFirstLogin,
        createAdminAccount,
        createResidentAccount,
        resetAdminAccountPassword,
        deleteAdminAccount,
        requestPasswordReset,
        resetPasswordWithCode,
        loading,
      }}
    >
      {!loading && children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
