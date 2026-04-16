"""Tests for puzzle_validation.validate_puzzle."""

import pytest

from app.puzzle_validation import validate_puzzle


# ---------------------------------------------------------------------------
# choice
# ---------------------------------------------------------------------------

class TestChoiceValidation:
    def test_valid(self):
        validate_puzzle("choice", "Which is largest?|Earth|Saturn|Jupiter|Mars", "C")

    def test_lowercase_answer_accepted(self):
        validate_puzzle("choice", "Pick one|Alpha|Beta", "b")

    def test_answer_must_be_single_letter(self):
        with pytest.raises(ValueError, match="single letter"):
            validate_puzzle("choice", "Q|A|B", "AB")

    def test_answer_must_correspond_to_option(self):
        with pytest.raises(ValueError, match="does not correspond"):
            validate_puzzle("choice", "Q|A|B", "C")

    def test_question_needs_at_least_two_options(self):
        with pytest.raises(ValueError, match="at least 2 options"):
            validate_puzzle("choice", "Q|OnlyOne", "A")

    def test_question_with_no_pipe_rejected(self):
        with pytest.raises(ValueError, match="at least 2 options"):
            validate_puzzle("choice", "No options here", "A")


# ---------------------------------------------------------------------------
# match
# ---------------------------------------------------------------------------

class TestMatchValidation:
    QUESTION = '{"prompt":"Match:","left":["A","B","C"],"right":["X","Y","Z"]}'

    def test_valid(self):
        validate_puzzle("match", self.QUESTION, "2,0,1")

    def test_invalid_json(self):
        with pytest.raises(ValueError, match="valid JSON"):
            validate_puzzle("match", "not json", "0,1")

    def test_mismatched_array_lengths(self):
        q = '{"prompt":"M","left":["A","B"],"right":["X","Y","Z"]}'
        with pytest.raises(ValueError, match="equal length"):
            validate_puzzle("match", q, "0,1")

    def test_answer_wrong_length(self):
        with pytest.raises(ValueError, match="3 comma-separated"):
            validate_puzzle("match", self.QUESTION, "0,1")

    def test_answer_not_a_permutation(self):
        with pytest.raises(ValueError, match="permutation"):
            validate_puzzle("match", self.QUESTION, "0,0,1")

    def test_missing_required_field(self):
        with pytest.raises(ValueError, match="missing required field"):
            validate_puzzle("match", '{"prompt":"M","left":["A"]}', "0")


# ---------------------------------------------------------------------------
# order
# ---------------------------------------------------------------------------

class TestOrderValidation:
    QUESTION = '{"prompt":"Sort:","items":["C","A","B"]}'

    def test_valid(self):
        validate_puzzle("order", self.QUESTION, "1,2,0")

    def test_answer_wrong_length(self):
        with pytest.raises(ValueError, match="3 comma-separated"):
            validate_puzzle("order", self.QUESTION, "0,1")

    def test_answer_not_a_permutation(self):
        with pytest.raises(ValueError, match="permutation"):
            validate_puzzle("order", self.QUESTION, "0,1,1")

    def test_needs_at_least_two_items(self):
        with pytest.raises(ValueError, match="at least 2"):
            validate_puzzle("order", '{"prompt":"Sort:","items":["only"]}', "0")


# ---------------------------------------------------------------------------
# connections
# ---------------------------------------------------------------------------

class TestConnectionsValidation:
    QUESTION = '{"prompt":"Group:","items":["a","b","c","d","e","f"],"categories":["X","Y","Z"]}'

    def test_valid(self):
        validate_puzzle("connections", self.QUESTION, "0,1|2,3|4,5")

    def test_wrong_number_of_groups(self):
        with pytest.raises(ValueError, match="3 pipe-separated groups"):
            validate_puzzle("connections", self.QUESTION, "0,1|2,3")

    def test_group_wrong_size(self):
        with pytest.raises(ValueError, match="group 1 must have 2 indices"):
            validate_puzzle("connections", self.QUESTION, "0|1,2,3|4,5")

    def test_duplicate_index(self):
        with pytest.raises(ValueError, match="exactly once"):
            validate_puzzle("connections", self.QUESTION, "0,1|2,1|4,5")

    def test_items_dont_divide_evenly(self):
        q = '{"prompt":"G","items":["a","b","c","d","e"],"categories":["X","Y"]}'
        with pytest.raises(ValueError, match="divide evenly"):
            validate_puzzle("connections", q, "0,1|2,3")


# ---------------------------------------------------------------------------
# numgrid
# ---------------------------------------------------------------------------

class TestNumgridValidation:
    def test_valid(self):
        validate_puzzle("numgrid", '{"prompt":"?","grid":[1,2,null,4]}', "3")

    def test_answer_must_be_number(self):
        with pytest.raises(ValueError, match="must be a number"):
            validate_puzzle("numgrid", '{"prompt":"?","grid":[1,null,3]}', "three")

    def test_grid_must_have_exactly_one_null(self):
        with pytest.raises(ValueError, match="exactly one null"):
            validate_puzzle("numgrid", '{"prompt":"?","grid":[1,2,3,4]}', "5")

    def test_grid_must_have_exactly_one_null_not_two(self):
        with pytest.raises(ValueError, match="exactly one null"):
            validate_puzzle("numgrid", '{"prompt":"?","grid":[null,null,3]}', "1")


# ---------------------------------------------------------------------------
# countdown
# ---------------------------------------------------------------------------

class TestCountdownValidation:
    QUESTION = '{"prompt":"Reach:","target":306,"numbers":[75,50,6],"operators":["+","-"]}'

    def test_valid(self):
        validate_puzzle("countdown", self.QUESTION, "306")

    def test_answer_must_be_number(self):
        with pytest.raises(ValueError, match="must be a number"):
            validate_puzzle("countdown", self.QUESTION, "three hundred")

    def test_missing_target(self):
        with pytest.raises(ValueError, match="missing required field"):
            validate_puzzle("countdown", '{"prompt":"R","numbers":[1],"operators":["+"]}', "1")


# ---------------------------------------------------------------------------
# scrabble
# ---------------------------------------------------------------------------

class TestScrabbleValidation:
    QUESTION = '{"prompt":"Score:","board":[null],"modifiers":[null],"rack":["A","B"]}'

    def test_valid(self):
        validate_puzzle("scrabble", self.QUESTION, "ab 4")

    def test_answer_must_be_word_score(self):
        with pytest.raises(ValueError, match="'word score'"):
            validate_puzzle("scrabble", self.QUESTION, "justword")

    def test_answer_score_must_be_number(self):
        with pytest.raises(ValueError, match="'word score'"):
            validate_puzzle("scrabble", self.QUESTION, "word abc")


# ---------------------------------------------------------------------------
# word-wheel
# ---------------------------------------------------------------------------

class TestWordWheelValidation:
    QUESTION = '{"prompt":"Find:","wheels":[{"letters":["A","B","C"]},{"letters":["D","E","F"]}]}'

    def test_valid(self):
        validate_puzzle("word-wheel", self.QUESTION, "abc def")

    def test_answer_word_count_must_match_wheels(self):
        with pytest.raises(ValueError, match="2 word"):
            validate_puzzle("word-wheel", self.QUESTION, "abc")

    def test_wheel_missing_letters(self):
        q = '{"prompt":"Find:","wheels":[{"noletters":[]}]}'
        with pytest.raises(ValueError, match="'letters' field"):
            validate_puzzle("word-wheel", q, "abc")


# ---------------------------------------------------------------------------
# image-tap
# ---------------------------------------------------------------------------

class TestImageTapValidation:
    QUESTION = '{"prompt":"Click:","image_url":"/img.jpg"}'

    def test_valid(self):
        validate_puzzle("image-tap", self.QUESTION, "0.25,0.75")

    def test_answer_must_be_two_coords(self):
        with pytest.raises(ValueError, match="'x,y' coordinates"):
            validate_puzzle("image-tap", self.QUESTION, "0.5")

    def test_coordinates_must_be_in_range(self):
        with pytest.raises(ValueError, match="between 0 and 1"):
            validate_puzzle("image-tap", self.QUESTION, "1.5,0.5")

    def test_missing_image_url(self):
        with pytest.raises(ValueError, match="missing required field"):
            validate_puzzle("image-tap", '{"prompt":"Click:"}', "0.5,0.5")


# ---------------------------------------------------------------------------
# image-order
# ---------------------------------------------------------------------------

class TestImageOrderValidation:
    QUESTION = '{"prompt":"Sort:","images":["/a.jpg","/b.jpg","/c.jpg"]}'

    def test_valid(self):
        validate_puzzle("image-order", self.QUESTION, "2,0,1")

    def test_answer_wrong_length(self):
        with pytest.raises(ValueError, match="3 comma-separated"):
            validate_puzzle("image-order", self.QUESTION, "0,1")

    def test_needs_at_least_two_images(self):
        with pytest.raises(ValueError, match="at least 2"):
            validate_puzzle("image-order", '{"prompt":"S","images":["/a.jpg"]}', "0")


# ---------------------------------------------------------------------------
# image-word
# ---------------------------------------------------------------------------

class TestImageWordValidation:
    QUESTION = '{"prompt":"Name it:","image_url":"/img.jpg"}'

    def test_valid(self):
        validate_puzzle("image-word", self.QUESTION, "dog")

    def test_empty_answer_rejected(self):
        with pytest.raises(ValueError, match="must not be empty"):
            validate_puzzle("image-word", self.QUESTION, "   ")

    def test_missing_image_url(self):
        with pytest.raises(ValueError, match="missing required field"):
            validate_puzzle("image-word", '{"prompt":"Name it:"}', "dog")


# ---------------------------------------------------------------------------
# wordsearch
# ---------------------------------------------------------------------------

class TestWordsearchValidation:
    def test_valid(self):
        validate_puzzle("wordsearch", "A B C\nD E F\nFind: ABC", "ABC")

    def test_missing_find_section(self):
        with pytest.raises(ValueError, match="Find:"):
            validate_puzzle("wordsearch", "A B C\nD E F", "ABC")

    def test_empty_answer_rejected(self):
        with pytest.raises(ValueError, match="must not be empty"):
            validate_puzzle("wordsearch", "A B\nFind: AB", "")


# ---------------------------------------------------------------------------
# Unvalidated types pass through without error
# ---------------------------------------------------------------------------

class TestUnvalidatedTypes:
    def test_word_no_constraints(self):
        validate_puzzle("word", "Anything goes", "Any answer")

    def test_math_no_constraints(self):
        validate_puzzle("math", "2+2=?", "4")

    def test_ladder_no_constraints(self):
        validate_puzzle("ladder", "C_T, __P", "a, a")

    def test_unknown_type_passes(self):
        # Types not in the validator dict are silently skipped
        validate_puzzle("future-type", "Q", "A")
