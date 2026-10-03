"""PDF exam → AI-extracted draft questions, plus the strict validation used before publishing."""

import logging
import re

from django.conf import settings
from django.db.models import Q
from django.utils import timezone

from . import ai_client
from .background import run_job, stale_after
from .models import ExamImport
from .pdf_pages import PdfReadError, render_pages
from .subjects import OFFICIAL_SUBJECTS, normalize_subject

logger = logging.getLogger(__name__)

MAX_CHOICES = 8
MAX_SHORT_FIELD = 255  # Question.correct_answer / topic column length

SYSTEM_PROMPT = f"""You extract multiple-choice questions from pages of an Ethiopian Computer Science BSc exit exam.
Pages are images (often phone photos or scans). A text layer is included when the PDF has one; trust the image when they disagree.

Return ONLY a JSON object, with no markdown fences and no commentary, in exactly this shape:
{{"title": "exam title if printed on these pages, else empty string", "questions": [{{"question": "...", "choices": ["...", "..."], "correctAnswer": "...", "explanation": "...", "subject": "...", "topic": "..."}}]}}

Rules:
- One entry per multiple-choice question, in page order.
- "question": the question text only. Remove question numbering such as "1." or "Q5)". Keep code snippets, using \\n for line breaks.
- "choices": the option texts only, without labels such as "A." or "(b)".
- "correctAnswer": must be exactly equal to one of the strings in "choices". If the page marks the answer by letter (A/B/C/D), return that choice's text. If no answer is marked, choose the correct one yourself.
- "explanation": 1-2 sentences on why the answer is correct.
- "subject": exactly one of: {'; '.join(OFFICIAL_SUBJECTS)}. If unclear, pick the best match from this list.
- "topic": a short topic name (2-5 words).
- Skip a question whose beginning is not visible because it continues from an earlier page. Include a question cut off at the end of the last page with whatever is visible.
- If the pages contain no questions (cover page, instructions, answer sheet), return {{"title": "", "questions": []}}."""

NUMBERING_RE = re.compile(r'^\s*(?:(?:q(?:uestion)?|no)\.?\s*)?\d{1,3}\s*(?:[.):]\s+|\s-\s+)', re.IGNORECASE)
CHOICE_LABEL_RE = re.compile(r'^\s*\(?([a-hA-H])\s*[.):]\s+')
ANSWER_LETTER_RE = re.compile(r'^\(?([a-hA-H])[.)]?$')
ANSWER_PREFIX_RE = re.compile(r'^\s*(?:correct\s+)?(?:answer|ans)\s*[:.\-]?\s*', re.IGNORECASE)


class ExtractionError(Exception):
    """A user-facing, retry-friendly extraction failure."""


BadAIOutput = ai_client.BadAIOutput


# ---------------------------------------------------------------------------
# Cleaning and validation (shared by AI drafts and publish)
# ---------------------------------------------------------------------------

def _clean_text(value):
    if value is None:
        return ''
    lines = [line.rstrip() for line in str(value).strip().splitlines()]
    return re.sub(r'\n{3,}', '\n\n', '\n'.join(lines)).strip()


def _clean_line(value):
    return ' '.join(str(value if value is not None else '').split())


def validate_question(q):
    """Return a list of problems that block saving this (already cleaned) question."""
    errors = []
    if not q['question']:
        errors.append('Question text is empty.')
    choices = q['choices']
    if len(choices) < 2:
        errors.append('Needs at least 2 choices.')
    if len(choices) > MAX_CHOICES:
        errors.append(f'At most {MAX_CHOICES} choices are allowed.')
    if any(not c for c in choices):
        errors.append('Choices cannot be empty.')
    if len(set(choices)) != len(choices):
        errors.append('Choices must be different from each other.')
    if not q['correctAnswer']:
        errors.append('Pick the correct answer.')
    elif q['correctAnswer'] not in choices:
        errors.append('Correct answer must be one of the choices.')
    elif len(q['correctAnswer']) > MAX_SHORT_FIELD:
        errors.append(f'Correct answer text is longer than {MAX_SHORT_FIELD} characters.')
    if q['subject'] not in OFFICIAL_SUBJECTS:
        errors.append('Pick a subject from the official list.')
    if len(q['topic']) > MAX_SHORT_FIELD:
        errors.append(f'Topic is longer than {MAX_SHORT_FIELD} characters.')
    return errors


def clean_submitted_question(raw):
    """Clean a reviewed question submitted for publishing. Returns (question, errors)."""
    if not isinstance(raw, dict):
        return None, ['Malformed question.']
    choices = raw.get('choices')
    if not isinstance(choices, list):
        choices = []
    q = {
        'question': _clean_text(raw.get('question')),
        'choices': [_clean_text(c) for c in choices],
        'correctAnswer': _clean_text(raw.get('correctAnswer')),
        'explanation': _clean_text(raw.get('explanation')),
        'subject': _clean_line(raw.get('subject')),
        'topic': _clean_line(raw.get('topic')),
    }
    return q, validate_question(q)


def _resolve_answer(answer, choices):
    if answer in choices:
        return answer
    answer = ANSWER_PREFIX_RE.sub('', answer, count=1)
    if answer in choices:
        return answer
    letter = ANSWER_LETTER_RE.match(answer)
    if letter:
        index = ord(letter.group(1).lower()) - ord('a')
        return choices[index] if index < len(choices) else ''
    unlabeled = CHOICE_LABEL_RE.sub('', answer, count=1)
    for choice in choices:
        if choice.lower() == unlabeled.lower():
            return choice
    return ''


def normalize_ai_question(raw, source_pages):
    """Turn one AI-produced question into a draft question with any blocking issues listed."""
    if not isinstance(raw, dict):
        return None
    raw_choices = raw.get('choices')
    if isinstance(raw_choices, dict):
        raw_choices = list(raw_choices.values())
    if not isinstance(raw_choices, list):
        raw_choices = []
    choices = [CHOICE_LABEL_RE.sub('', _clean_text(c), count=1) for c in raw_choices if _clean_text(c)]
    question_text = NUMBERING_RE.sub('', _clean_text(raw.get('question')), count=1)
    if not question_text and not choices:
        return None

    q = {
        'question': question_text,
        'choices': choices,
        'correctAnswer': _resolve_answer(_clean_text(raw.get('correctAnswer')), choices),
        'explanation': _clean_text(raw.get('explanation')),
        'subject': normalize_subject(raw.get('subject')) or '',
        'topic': _clean_line(raw.get('topic'))[:MAX_SHORT_FIELD] or 'General',
    }
    q['sourcePages'] = source_pages
    q['issues'] = validate_question(q)
    return q


def parse_ai_json(text):
    """Parse the model's reply into {'title': str, 'questions': list}; raise BadAIOutput otherwise."""
    data = ai_client.parse_json_reply(text)
    if isinstance(data, list):
        data = {'title': '', 'questions': data}
    if not isinstance(data, dict) or not isinstance(data.get('questions'), list):
        raise BadAIOutput('missing "questions" array')
    title = data.get('title')
    return {'title': _clean_line(title)[:MAX_SHORT_FIELD] if isinstance(title, str) else '', 'questions': data['questions']}


# ---------------------------------------------------------------------------
# AI extraction
# ---------------------------------------------------------------------------

def build_messages(pages, page_count):
    content = [{
        'type': 'text',
        'text': f"Exam pages {pages[0]['number']}-{pages[-1]['number']} of {page_count}. Extract the questions as instructed.",
    }]
    for page in pages:
        label = f"Page {page['number']}:"
        if page['text']:
            label += f"\nText layer (may be incomplete or garbled):\n{page['text']}"
        content.append({'type': 'text', 'text': label})
        content.append({'type': 'image_url', 'image_url': {'url': page['image_data_url'], 'detail': 'high'}})
    return [
        {'role': 'system', 'content': SYSTEM_PROMPT},
        {'role': 'user', 'content': content},
    ]


def extract_batch(pages, page_count):
    """Extract (title, draft_questions) from a batch of rendered pages, retrying once on bad output."""
    page_range = f"{pages[0]['number']}-{pages[-1]['number']}"
    messages = build_messages(pages, page_count)
    last_error = None
    finish_reason = None
    for _attempt in range(2):
        try:
            text, finish_reason = ai_client.chat_completion(messages)
            parsed = parse_ai_json(text)
        except ai_client.AIConfigError as exc:
            raise ExtractionError(str(exc)) from exc
        except ai_client.AIUnavailableError as exc:
            last_error = ExtractionError(f'{exc} Pages {page_range} were not read; retry to continue.')
            continue
        except BadAIOutput as exc:
            hint = ' The reply was cut off; try a smaller EXAM_IMPORT_PAGES_PER_BATCH.' if finish_reason == 'length' else ''
            logger.warning('Unreadable AI output for pages %s: %s', page_range, exc)
            last_error = ExtractionError(f'The AI returned an unreadable answer for pages {page_range}.{hint} Retry to try again.')
            continue

        source_pages = [p['number'] for p in pages]
        questions = [q for q in (normalize_ai_question(raw, source_pages) for raw in parsed['questions']) if q]
        return parsed['title'], questions
    raise last_error


def _merge(existing, new_questions):
    seen = {q['question'].lower() for q in existing if q.get('question')}
    merged = list(existing)
    for q in new_questions:
        key = q['question'].lower()
        if key and key in seen:
            continue
        seen.add(key)
        merged.append(q)
    return merged


# ---------------------------------------------------------------------------
# Job control
# ---------------------------------------------------------------------------

def mark_if_stale(exam_import):
    """Fail an extraction whose worker stopped updating (e.g. the server restarted or slept)."""
    if exam_import.status != ExamImport.STATUS_EXTRACTING:
        return exam_import
    if exam_import.updated_at >= timezone.now() - stale_after():
        return exam_import
    ExamImport.objects.filter(pk=exam_import.pk, status=ExamImport.STATUS_EXTRACTING).update(
        status=ExamImport.STATUS_FAILED,
        error=f'Extraction was interrupted (the server may have restarted). Retry to continue from page {exam_import.pages_processed + 1}.',
        updated_at=timezone.now(),
    )
    exam_import.refresh_from_db()
    return exam_import


def claim_for_extraction(exam_import):
    """Atomically move an import into 'extracting'. Returns False if another worker owns it."""
    claimable = (
        Q(status__in=[ExamImport.STATUS_PENDING, ExamImport.STATUS_FAILED])
        | Q(status=ExamImport.STATUS_EXTRACTING, updated_at__lt=timezone.now() - stale_after())
    )
    return ExamImport.objects.filter(claimable, pk=exam_import.pk).update(
        status=ExamImport.STATUS_EXTRACTING, error='', updated_at=timezone.now(),
    ) == 1


def _fail(import_id, message):
    ExamImport.objects.filter(pk=import_id, status=ExamImport.STATUS_EXTRACTING).update(
        status=ExamImport.STATUS_FAILED, error=message, updated_at=timezone.now(),
    )


def run_extraction(import_id):
    """Extract remaining pages batch by batch, saving progress after each batch."""
    batch_size = max(1, settings.EXAM_IMPORT_PAGES_PER_BATCH)
    while True:
        exam_import = ExamImport.objects.filter(pk=import_id, status=ExamImport.STATUS_EXTRACTING).first()
        if exam_import is None:
            return
        start = exam_import.pages_processed
        end = min(start + batch_size, exam_import.page_count)
        if start >= end:
            ExamImport.objects.filter(pk=import_id).update(status=ExamImport.STATUS_READY, updated_at=timezone.now())
            return

        try:
            try:
                with exam_import.pdf.open('rb') as pdf_file:
                    data = pdf_file.read()
            except (FileNotFoundError, ValueError) as exc:
                raise ExtractionError('The uploaded PDF is no longer on the server (it may have restarted). Please upload it again.') from exc
            pages = render_pages(data, start, end)
            title, questions = extract_batch(pages, exam_import.page_count)
        except (ExtractionError, PdfReadError) as exc:
            _fail(import_id, str(exc))
            return
        except Exception:
            logger.exception('Exam import %s failed on pages %s-%s', import_id, start + 1, end)
            _fail(import_id, f'Unexpected error while reading pages {start + 1}-{end}. Retry to continue.')
            return

        ExamImport.objects.filter(pk=import_id, status=ExamImport.STATUS_EXTRACTING).update(
            pages_processed=end,
            draft_questions=_merge(exam_import.draft_questions, questions),
            title=exam_import.title or title,
            status=ExamImport.STATUS_READY if end >= exam_import.page_count else ExamImport.STATUS_EXTRACTING,
            updated_at=timezone.now(),
        )


def start_extraction(exam_import):
    run_job(run_extraction, exam_import.pk)
