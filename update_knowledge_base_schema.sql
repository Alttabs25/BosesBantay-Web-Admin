-- ==============================================================================
-- BOSESBANTAY: Knowledge Base & Document Management Schema Update
-- Enhances public.documents and adds public.document_chunks for Barangay-Bot RAG
-- ==============================================================================

-- 1. Enable pgvector extension (if not already enabled)
CREATE EXTENSION IF NOT EXISTS vector;

-- 2. Add technical ingestion & RAG fields to public.documents
ALTER TABLE public.documents
  ADD COLUMN IF NOT EXISTS file_format VARCHAR(10) DEFAULT 'PDF',
  ADD COLUMN IF NOT EXISTS file_size VARCHAR(50) NULL,
  ADD COLUMN IF NOT EXISTS is_machine_readable BOOLEAN DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS chunk_count INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS vector_status VARCHAR(30) DEFAULT 'Pending',
  ADD COLUMN IF NOT EXISTS summary TEXT NULL,
  ADD COLUMN IF NOT EXISTS sections JSONB NULL;

-- 3. Create document_chunks table for granular legal sections & nomic-embed-text-v1 embeddings
CREATE TABLE IF NOT EXISTS public.document_chunks (
    chunk_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    document_id BIGINT REFERENCES public.documents(document_id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    section_title VARCHAR(255) NULL,
    chunk_index INT NOT NULL,
    embedding vector(768) NULL, -- nomic-embed-text-v1 (768 dimensions)
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS on document_chunks
ALTER TABLE public.document_chunks ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read document chunks
CREATE POLICY "Allow authenticated read chunks"
  ON public.document_chunks
  FOR SELECT
  TO authenticated
  USING (true);

-- 4. Fast Cosine Similarity Index (HNSW) for vector search
CREATE INDEX IF NOT EXISTS document_chunks_embedding_idx
  ON public.document_chunks
  USING hnsw (embedding vector_cosine_ops);

-- 5. Helper RPC function for Barangay-Bot RAG retrieval (nomic-embed-text-v1 + 0.73 threshold)
CREATE OR REPLACE FUNCTION public.match_document_chunks (
  query_embedding vector(768),
  match_threshold float DEFAULT 0.73,
  match_count int DEFAULT 5
)
RETURNS TABLE (
  chunk_id bigint,
  document_id bigint,
  document_title varchar(255),
  document_type varchar(100),
  ordinance_no varchar(50),
  section_title varchar(255),
  content text,
  similarity float
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    dc.chunk_id,
    dc.document_id,
    d.title AS document_title,
    d.document_type,
    d.ordinance_no,
    dc.section_title,
    dc.content,
    1 - (dc.embedding <=> query_embedding) AS similarity
  FROM public.document_chunks dc
  JOIN public.documents d ON dc.document_id = d.document_id
  WHERE d.approval_status = 'Approved'
    AND d.is_active = TRUE
    AND 1 - (dc.embedding <=> query_embedding) >= match_threshold
  ORDER BY similarity DESC
  LIMIT match_count;
END;
$$;

-- Grant access to authenticated users
GRANT EXECUTE ON FUNCTION public.match_document_chunks TO authenticated;
GRANT SELECT ON public.document_chunks TO authenticated;
