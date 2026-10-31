import unittest
from unittest.mock import MagicMock,patch
from menu_flow import ChatState,handle_message,remember_answer
from menu_chat import stream_menu_answer

class ContextTests(unittest.TestCase):
    def state(self):
        state=ChatState()
        handle_message('Magkano ang barangay clearance?',state)
        remember_answer(state,'A previously supported reply.')
        return state
    def test_contextual_followups_keep_topic_and_detail(self):
        for question in ['why?','bakit ganon?','can you explain more?','what does that mean?','ano ibig sabihin niyan?']:
            with self.subTest(question=question):
                state=self.state();decision=handle_message(question,state)
                self.assertEqual(decision.kind,'answer')
                self.assertEqual(state.selected_topic,'clearance')
                self.assertEqual(state.selected_detail,'fee')
                self.assertIn('clearance',decision.query.lower())
                self.assertIn('Current detail:',decision.query)
    def test_missing_followup_keeps_context_and_asks_detail(self):
        state=self.state();decision=handle_message('bakit ganon?',state)
        with patch('chat.retrieve',return_value=()): events=list(stream_menu_answer(decision,state,MagicMock(),MagicMock()))
        self.assertEqual(state.selected_topic,'clearance')
        self.assertEqual(state.current_step,'detail')
        self.assertIn('Barangay Hall',events[0].text)
        self.assertNotIn('Paumanhin',events[0].text)
        followup=handle_message('magkano?',state)
        self.assertEqual(followup.kind,'answer')
        self.assertEqual(state.selected_topic,'clearance')
    def test_explicit_topic_change_wins(self):
        state=self.state();decision=handle_message('What are the requirements for residency?',state)
        self.assertEqual(decision.kind,'answer')
        self.assertNotEqual(state.selected_topic,'clearance')
    def test_unrelated_request_is_not_forced_into_previous_topic(self):
        state=self.state();decision=handle_message('Write a movie review',state)
        self.assertEqual(decision.kind,'menu')
        self.assertFalse(decision.query)
    def test_direct_question_keeps_actual_requested_detail(self):
        state=ChatState();decision=handle_message('Magkano ang barangay clearance?',state)
        self.assertEqual(state.selected_detail,'fee')
        self.assertIn('magkano',decision.query.lower())
if __name__=='__main__':unittest.main()
