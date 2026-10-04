"""MoE exit-exam blueprint PDF → AI-extracted curriculum draft (themes, courses, focus notes), plus draft validation."""

import copy
import logging
import math

from django.conf import settings
from django.db.models import Q
from django.utils import timezone

from . import ai_client
from .background import run_job, stale_after
from .curriculum import course_key
from .models import BlueprintImport
from .pdf_pages import PdfReadError, render_pages

logger = logging.getLogger(__name__)

MAX_THEMES = 40
MAX_COURSES = 150
MAX_NAME = 255
MAX_FOCUS_NOTES = 4000

SYSTEM_PROMPT = """You read pages of an Ethiopian Ministry of Education (MoE) "Test Blueprint for National Exit Examination".
The program can be anything (Computer Science, Civil Engineering, Nursing, Accounting...). Pages are images (often scans or phone photos); a text layer is included when the PDF has one, but trust the image when they disagree.

A blueprint groups the program's courses into themes. Tables give credit hours, each theme's share of the test items, and per-course item counts or weights (often out of 100 items). Other pages list each course's learning outcomes, general objectives and cognitive-domain breakdown (Remember, Understand, Apply, Analyze, Evaluate, Create).

Return ONLY a JSON object, with no markdown fences and no commentary, in exactly this shape:
{"programName": "full program name if printed on these pages, else empty string",
 "themes": [{"name": "theme name", "creditHours": number or null, "itemShare": number or null,
   "courses": [{"name": "course name", "creditHours": number or null, "itemCount": number or null, "weight": number or null,
     "focusNotes": "plain text"}]}]}

Rules:
- Only report what appears on THESE pages. Pages may hold only part of the blueprint; other pages are read separately and merged by theme and course name.
- Use the exact course and theme names as printed. When a page only shows learning outcomes for a course, still return that course (with null numbers) under its theme, or under a theme with an empty name if the theme is not shown.
- "itemShare": the theme's share of exam items as printed (a count or percent number, without the % sign).
- "itemCount": the course's number of test items. "weight": the course's weight as printed (a number), else null.
- "focusNotes": short bullet lines ("- ...") summarizing what to study for the course: key learning outcomes and the cognitive emphasis (e.g. "mostly Apply/Analyze"). At most about 1000 characters. Empty string if these pages say nothing about it.
- Numbers must be JSON numbers or null, never strings.
- If the pages contain no blueprint content (cover page, preface, signatures), return {"programName": "", "themes": []}."""


class ExtractionError(Exception):
    """A user-facing, retry-friendly extraction failure."""


# ---------------------------------------------------------------------------
# Cleaning, merging and validation (shared by AI output and the reviewed draft)
# ---------------------------------------------------------------------------

def _line(value, max_len=MAX_NAME):
    return ' '.join(str(value if value is not None else '').split())[:max_len]


def _notes(value):
    if isinstance(value, list):
        value = '\n'.join(f'- {_line(item, 500)}' for item in value if _line(item, 500))
    lines = [line.rstrip() for line in str(value if value is not None else '').strip().splitlines()]
    return '\n'.join(line for line in lines if line.strip())[:MAX_FOCUS_NOTES]


def _number(value, integer=False):
    if isinstance(value, bool) or value is None:
        return None
    try:
        number = float(str(value).strip().rstrip('%').strip())
    except ValueError:
        return None
    if not math.isfinite(number) or number < 0:
        return None
    return int(round(number)) if integer else round(number, 4)


def _clean_course(raw, order):
    if not isinstance(raw, dict):
        return None
    course = {
        'name': _line(raw.get('name')),
        'creditHours': _number(raw.get('creditHours')),
        'itemCount': _number(raw.get('itemCount'), integer=True),
        'weight': _number(raw.get('weight')),
        'focusNotes': _notes(raw.get('focusNotes')),
        'order': order,
    }
    return course if course['name'] or course['focusNotes'] else None


def clean_draft(raw):
    """Normalize a draft (from the AI or the review form) into the documented shape; orders follow list position."""
    raw = raw if isinstance(raw, dict) else {}
    themes = []
    for raw_theme in raw.get('themes') if isinstance(raw.get('themes'), list) else []:
        if not isinstance(raw_theme, dict):
            continue
        raw_courses = raw_theme.get('courses') if isinstance(raw_theme.get('courses'), list) else []
        courses = [c for c in (_clean_course(rc, 0) for rc in raw_courses) if c]
        for order, course in enumerate(courses):
            course['order'] = order
        name = _line(raw_theme.get('name'))
        if not name and not courses:
            continue
        themes.append({
            'name': name,
            'creditHours': _number(raw_theme.get('creditHours')),
            'itemShare': _number(raw_theme.get('itemShare')),
            'order': len(themes),
            'courses': courses,
        })
    return {'programName': _line(raw.get('programName')), 'themes': themes}


def _fill_missing(target, source, fields):
    for field in fields:
        if target.get(field) is None and source.get(field) is not None:
            target[field] = source[field]


def merge_drafts(base, extra):
    """Merge a later page batch into the draft so far, matching themes and courses by name."""
    merged = copy.deepcopy(base) if base and base.get('themes') is not None else {'programName': '', 'themes': []}
    merged['programName'] = merged.get('programName') or extra['programName']
    themes = merged['themes']
    theme_index = {course_key(theme['name']): theme for theme in themes if theme['name']}
    course_index = {course_key(course['name']): course for theme in themes for course in theme['courses']}

    for theme in extra['themes']:
        target = theme_index.get(course_key(theme['name'])) if theme['name'] else None
        if target is None:
            target = {**theme, 'courses': []}
            themes.append(target)
            if theme['name']:
                theme_index[course_key(theme['name'])] = target
        _fill_missing(target, theme, ['creditHours', 'itemShare'])
        for course in theme['courses']:
            existing = course_index.get(course_key(course['name'])) if course['name'] else None
            if existing is None:
                target['courses'].append(dict(course))
                if course['name']:
                    course_index[course_key(course['name'])] = target['courses'][-1]
                continue
            _fill_missing(existing, course, ['creditHours', 'itemCount', 'weight'])
            if course['focusNotes'] and course['focusNotes'] not in existing['focusNotes']:
                existing['focusNotes'] = '\n'.join(filter(None, [existing['focusNotes'], course['focusNotes']]))[:MAX_FOCUS_NOTES]

    merged['themes'] = [theme for theme in themes if theme['courses'] or theme['name']]
    for order, theme in enumerate(merged['themes']):
        theme['order'] = order
        for course_order, course in enumerate(theme['courses']):
            course['order'] = course_order
    return merged


def course_count(draft):
    return sum(len(theme['courses']) for theme in draft.get('themes', []))


def validate_draft(draft):
    """Problems that block applying a (cleaned) draft."""
    errors = []
    if not draft['programName']:
        errors.append('Give the program a name.')
    if not course_count(draft):
        errors.append('Add at least one course.')
    if len(draft['themes']) > MAX_THEMES:
        errors.append(f'At most {MAX_THEMES} themes are allowed.')
    if course_count(draft) > MAX_COURSES:
        errors.append(f'At most {MAX_COURSES} courses are allowed.')
    seen = set()
    for theme_number, theme in enumerate(draft['themes'], start=1):
        if not theme['name']:
            errors.append(f'Theme {theme_number} needs a name.')
        for course in theme['courses']:
            if not course['name']:
                errors.append(f'A course in "{theme["name"] or f"theme {theme_number}"}" needs a name.')
                continue
            lower = course['name'].lower()
            if lower in seen:
                errors.append(f'"{course["name"]}" appears more than once; each course can only be listed once.')
            seen.add(lower)
    return errors


# ---------------------------------------------------------------------------
# AI extraction
# ---------------------------------------------------------------------------

def build_messages(pages, page_count, draft_so_far):
    known = [course['name'] for theme in draft_so_far.get('themes', []) for course in theme['courses'] if course['name']]
    intro = f"Blueprint pages {pages[0]['number']}-{pages[-1]['number']} of {page_count}. Extract the curriculum as instructed."
    if known:
        intro += '\nCourses already found on earlier pages (reuse these exact names when the same course appears): ' + '; '.join(known)
    content = [{'type': 'text', 'text': intro}]
    for page in pages:
        label = f"Page {page['number']}:"
        if page['text']:
            label += f"\nText layer (may be incomplete or garbled):\n{page['text']}"
        content.append({'type': 'text', 'text': label})
        content.append({'type': 'image_url', 'image_url': {'url': page['image_data_url']}})
    return [
        {'role': 'system', 'content': SYSTEM_PROMPT},
        {'role': 'user', 'content': content},
    ]


def extract_batch(pages, page_count, draft_so_far):
    """Extract a partial draft from a batch of rendered pages, retrying once on unreadable output."""
    page_range = f"{pages[0]['number']}-{pages[-1]['number']}"
    messages = build_messages(pages, page_count, draft_so_far)
    last_error = None
    for _attempt in range(2):
        try:
            return clean_draft(ai_client.parse_json_reply(ai_client.complete(messages)))
        except ai_client.AIConfigError as exc:
            raise ExtractionError(str(exc)) from exc
        except ai_client.AIUnavailableError as exc:
            last_error = ExtractionError(f'{exc} Pages {page_range} were not read; retry to continue.')
            if isinstance(exc, ai_client.AITimeoutError):
                break
        except ai_client.BadAIOutput as exc:
            logger.warning('Unreadable AI output for blueprint pages %s: %s', page_range, exc)
            last_error = ExtractionError(f'The AI returned an unreadable answer for pages {page_range}. Retry to try again.')
    raise last_error


# ---------------------------------------------------------------------------
# Job control
# ---------------------------------------------------------------------------

def pages_per_batch():
    return max(1, min(settings.BLUEPRINT_IMPORT_PAGES_PER_BATCH, ai_client.MAX_IMAGES_PER_SEND))


def mark_if_stale(blueprint_import):
    if blueprint_import.status != BlueprintImport.STATUS_EXTRACTING:
        return blueprint_import
    if blueprint_import.updated_at >= timezone.now() - stale_after():
        return blueprint_import
    BlueprintImport.objects.filter(pk=blueprint_import.pk, status=BlueprintImport.STATUS_EXTRACTING).update(
        status=BlueprintImport.STATUS_FAILED,
        error=f'Extraction was interrupted (the server may have restarted). Retry to continue from page {blueprint_import.pages_processed + 1}.',
        updated_at=timezone.now(),
    )
    blueprint_import.refresh_from_db()
    return blueprint_import


def claim_for_extraction(blueprint_import):
    claimable = (
        Q(status__in=[BlueprintImport.STATUS_PENDING, BlueprintImport.STATUS_FAILED])
        | Q(status=BlueprintImport.STATUS_EXTRACTING, updated_at__lt=timezone.now() - stale_after())
    )
    return BlueprintImport.objects.filter(claimable, pk=blueprint_import.pk).update(
        status=BlueprintImport.STATUS_EXTRACTING, error='', updated_at=timezone.now(),
    ) == 1


def _fail(import_id, message):
    BlueprintImport.objects.filter(pk=import_id, status=BlueprintImport.STATUS_EXTRACTING).update(
        status=BlueprintImport.STATUS_FAILED, error=message, updated_at=timezone.now(),
    )


def run_extraction(import_id):
    """Extract remaining pages batch by batch, merging each batch into the saved draft."""
    batch_size = pages_per_batch()
    while True:
        blueprint_import = BlueprintImport.objects.filter(pk=import_id, status=BlueprintImport.STATUS_EXTRACTING).first()
        if blueprint_import is None:
            return
        start = blueprint_import.pages_processed
        end = min(start + batch_size, blueprint_import.page_count)
        if start >= end:
            BlueprintImport.objects.filter(pk=import_id).update(status=BlueprintImport.STATUS_READY, updated_at=timezone.now())
            return

        try:
            try:
                with blueprint_import.pdf.open('rb') as pdf_file:
                    data = pdf_file.read()
            except (FileNotFoundError, ValueError) as exc:
                raise ExtractionError('The uploaded PDF is no longer on the server (it may have restarted). Please upload it again.') from exc
            pages = render_pages(data, start, end)
            partial = extract_batch(pages, blueprint_import.page_count, blueprint_import.draft)
        except (ExtractionError, PdfReadError) as exc:
            _fail(import_id, str(exc))
            return
        except Exception:
            logger.exception('Blueprint import %s failed on pages %s-%s', import_id, start + 1, end)
            _fail(import_id, f'Unexpected error while reading pages {start + 1}-{end}. Retry to continue.')
            return

        BlueprintImport.objects.filter(pk=import_id, status=BlueprintImport.STATUS_EXTRACTING).update(
            pages_processed=end,
            draft=merge_drafts(blueprint_import.draft, partial),
            status=BlueprintImport.STATUS_READY if end >= blueprint_import.page_count else BlueprintImport.STATUS_EXTRACTING,
            updated_at=timezone.now(),
        )


def start_extraction(blueprint_import):
    run_job(run_extraction, blueprint_import.pk)
