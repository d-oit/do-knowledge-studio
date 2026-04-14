#!/usr/bin/env python3
"""
Accessibility verification script.
Checks HTML files for common WCAG violations.
"""

import sys
import re
import json
from pathlib import Path
from typing import List, Dict, Tuple


def check_alt_text(html: str) -> List[Dict]:
    """Check for images missing alt text (1.1.1)"""
    issues = []
    img_pattern = r'<img[^>]*?>'
    for match in re.finditer(img_pattern, html, re.IGNORECASE):
        tag = match.group(0)
        if 'alt=' not in tag.lower():
            issues.append({
                'criterion': '1.1.1',
                'severity': 'critical',
                'message': 'Image missing alt attribute',
                'context': tag[:80] + '...' if len(tag) > 80 else tag,
                'fix': 'Add alt="description" or alt="" for decorative'
            })
    return issues


def check_form_labels(html: str) -> List[Dict]:
    """Check for form inputs without labels (3.3.2, 1.3.1)"""
    issues = []
    input_pattern = r'<input[^>]*?>'
    for match in re.finditer(input_pattern, html, re.IGNORECASE):
        tag = match.group(0)
        has_label = 'id=' in tag.lower() and re.search(r'<label[^>]*?for=', html, re.IGNORECASE)
        has_aria_label = 'aria-label=' in tag.lower() or 'aria-labelledby=' in tag.lower()
        has_placeholder = 'placeholder=' in tag.lower()
        
        if not has_label and not has_aria_label:
            issues.append({
                'criterion': '3.3.2',
                'severity': 'high',
                'message': 'Form input missing accessible label',
                'context': tag[:80] + '...' if len(tag) > 80 else tag,
                'fix': 'Add <label for="id"> or aria-label attribute'
            })
        elif has_placeholder and not has_label and not has_aria_label:
            issues.append({
                'criterion': '1.3.1',
                'severity': 'medium',
                'message': 'Input using placeholder as label (bad practice)',
                'context': tag[:80] + '...' if len(tag) > 80 else tag,
                'fix': 'Add explicit <label> element'
            })
    return issues


def check_contrast_styles(html: str) -> List[Dict]:
    """Check for common low contrast patterns in style attributes (1.4.3)"""
    issues = []
    # Common low contrast combinations
    low_contrast_patterns = [
        (r'color\s*:\s*#666', 'Medium gray text may fail AA on white'),
        (r'color\s*:\s*#777', 'Medium gray text may fail AA on white'),
        (r'color\s*:\s*#888', 'Light gray text fails AA on white'),
        (r'color\s*:\s*#999', 'Light gray text fails AA on white'),
        (r'color\s*:\s*#aaa', 'Very light gray text fails AA'),
        (r'color\s*:\s*light(?:gray|grey)', 'Named light gray fails AA'),
    ]
    
    style_pattern = r'style="[^"]*"'
    for match in re.finditer(style_pattern, html, re.IGNORECASE):
        style = match.group(0)
        for pattern, message in low_contrast_patterns:
            if re.search(pattern, style, re.IGNORECASE):
                issues.append({
                    'criterion': '1.4.3',
                    'severity': 'high',
                    'message': message,
                    'context': style[:80],
                    'fix': 'Use darker color (minimum 4.5:1 contrast ratio)'
                })
                break
    return issues


def check_skip_link(html: str) -> List[Dict]:
    """Check for skip link (2.4.1)"""
    issues = []
    has_skip_link = re.search(r'href\s*=\s*"#\w+"[^>]*?>\s*(?:Skip|Jump|Bypass)', html, re.IGNORECASE)
    has_main = re.search(r'<main[^>]*>', html, re.IGNORECASE) or re.search(r'role\s*=\s*"main"', html, re.IGNORECASE)
    
    if not has_skip_link and has_main:
        issues.append({
            'criterion': '2.4.1',
            'severity': 'medium',
            'message': 'Missing skip link for main content',
            'context': 'First focusable element should be skip link',
            'fix': 'Add <a href="#main">Skip to main content</a>'
        })
    return issues


def check_heading_hierarchy(html: str) -> List[Dict]:
    """Check heading hierarchy (1.3.1)"""
    issues = []
    headings = re.findall(r'<h([1-6])[^>]*>', html, re.IGNORECASE)
    if headings:
        prev_level = 0
        for level in headings:
            level_int = int(level)
            if level_int > prev_level + 1 and prev_level > 0:
                issues.append({
                    'criterion': '1.3.1',
                    'severity': 'medium',
                    'message': f'Skipped heading level (h{prev_level} to h{level_int})',
                    'context': f'h{level_int} found after h{prev_level}',
                    'fix': f'Use h{prev_level + 1} instead of h{level_int}'
                })
            prev_level = level_int
    return issues


def check_page_title(html: str) -> List[Dict]:
    """Check for page title (2.4.2)"""
    issues = []
    has_title = re.search(r'<title[^>]*>[^<]+</title>', html, re.IGNORECASE)
    if not has_title:
        issues.append({
            'criterion': '2.4.2',
            'severity': 'high',
            'message': 'Missing page title',
            'context': '<title> element not found in <head>',
            'fix': 'Add <title>Descriptive Page Title</title>'
        })
    return issues


def check_language_attr(html: str) -> List[Dict]:
    """Check for lang attribute (3.1.1)"""
    issues = []
    has_lang = re.search(r'<html[^>]*lang\s*=\s*"[^"]+"', html, re.IGNORECASE)
    if not has_lang:
        issues.append({
            'criterion': '3.1.1',
            'severity': 'medium',
            'message': 'Missing language attribute on html element',
            'context': '<html> without lang attribute',
            'fix': 'Add <html lang="en"> (or appropriate language)'
        })
    return issues


def check_keyboard_traps(html: str) -> List[Dict]:
    """Check for potential keyboard traps (2.1.2)"""
    issues = []
    # Look for elements that might trap focus
    modal_patterns = [
        r'role\s*=\s*"dialog"',
        r'class\s*=\s*"modal"',
        r'class\s*=\s*"dialog"',
    ]
    
    has_modal = any(re.search(pattern, html, re.IGNORECASE) for pattern in modal_patterns)
    has_keydown = 'onkeydown' in html.lower() or 'keydown' in html.lower()
    
    if has_modal and not has_keydown:
        issues.append({
            'criterion': '2.1.2',
            'severity': 'high',
            'message': 'Modal/dialog may trap keyboard focus',
            'context': 'Dialog found without keyboard event handlers',
            'fix': 'Add Escape key handler and focus trap'
        })
    return issues


def check_focus_indicators(html: str) -> List[Dict]:
    """Check for focus indicator suppression (2.4.7)"""
    issues = []
    # Check for outline: none or outline: 0
    outline_pattern = r'outline\s*:\s*(?:none|0)\s*!important'
    if re.search(outline_pattern, html, re.IGNORECASE):
        issues.append({
            'criterion': '2.4.7',
            'severity': 'high',
            'message': 'Focus indicator may be suppressed',
            'context': 'outline: none !important found',
            'fix': 'Replace with visible focus indicator'
        })
    return issues


def check_link_purpose(html: str) -> List[Dict]:
    """Check for ambiguous link text (2.4.4)"""
    issues = []
    ambiguous_texts = ['click here', 'read more', 'learn more', 'here', 'link', 'more']
    
    link_pattern = r'<a[^>]*>(.*?)</a>'
    for match in re.finditer(link_pattern, html, re.IGNORECASE | re.DOTALL):
        link_text = re.sub(r'<[^>]+>', '', match.group(1)).strip().lower()
        if link_text in ambiguous_texts:
            issues.append({
                'criterion': '2.4.4',
                'severity': 'medium',
                'message': f'Ambiguous link text: "{link_text}"',
                'context': match.group(0)[:80],
                'fix': f'Use descriptive text like "Read about [topic]"'
            })
    return issues


def run_accessibility_check(file_path: str) -> Dict:
    """Run all checks on an HTML file"""
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            html = f.read()
    except Exception as e:
        return {
            'file': file_path,
            'error': str(e),
            'issues': []
        }
    
    all_issues = []
    all_issues.extend(check_alt_text(html))
    all_issues.extend(check_form_labels(html))
    all_issues.extend(check_contrast_styles(html))
    all_issues.extend(check_skip_link(html))
    all_issues.extend(check_heading_hierarchy(html))
    all_issues.extend(check_page_title(html))
    all_issues.extend(check_language_attr(html))
    all_issues.extend(check_keyboard_traps(html))
    all_issues.extend(check_focus_indicators(html))
    all_issues.extend(check_link_purpose(html))
    
    # Sort by severity
    severity_order = {'critical': 0, 'high': 1, 'medium': 2, 'low': 3}
    all_issues.sort(key=lambda x: severity_order.get(x['severity'], 4))
    
    return {
        'file': file_path,
        'total_issues': len(all_issues),
        'critical': len([i for i in all_issues if i['severity'] == 'critical']),
        'high': len([i for i in all_issues if i['severity'] == 'high']),
        'medium': len([i for i in all_issues if i['severity'] == 'medium']),
        'low': len([i for i in all_issues if i['severity'] == 'low']),
        'issues': all_issues
    }


def main():
    """Main entry point"""
    if len(sys.argv) < 2:
        print("Usage: python verify_accessibility.py <html_file_or_directory>")
        print("\nExamples:")
        print("  python verify_accessibility.py index.html")
        print("  python verify_accessibility.py ./src/components/")
        sys.exit(1)
    
    target = sys.argv[1]
    path = Path(target)
    
    if path.is_file():
        results = [run_accessibility_check(str(path))]
    elif path.is_dir():
        results = []
        for html_file in path.rglob('*.html'):
            results.append(run_accessibility_check(str(html_file)))
    else:
        print(f"Error: {target} not found")
        sys.exit(1)
    
    # Print results
    total_files = len(results)
    total_issues = sum(r['total_issues'] for r in results)
    
    print(f"\n{'='*60}")
    print(f"ACCESSIBILITY AUDIT REPORT")
    print(f"{'='*60}")
    print(f"Files analyzed: {total_files}")
    print(f"Total issues: {total_issues}")
    print(f"{'='*60}\n")
    
    for result in results:
        if 'error' in result:
            print(f"\n❌ Error reading {result['file']}: {result['error']}")
            continue
        
        if result['total_issues'] == 0:
            print(f"\n✅ {result['file']}: No issues found")
            continue
        
        print(f"\n📄 {result['file']}")
        print(f"   Issues: {result['total_issues']} "
              f"(Critical: {result['critical']}, High: {result['high']}, "
              f"Medium: {result['medium']}, Low: {result['low']})")
        
        for issue in result['issues']:
            severity_emoji = {
                'critical': '🔴',
                'high': '🟠',
                'medium': '🟡',
                'low': '🔵'
            }.get(issue['severity'], '⚪')
            
            print(f"\n   {severity_emoji} {issue['criterion']} - {issue['severity'].upper()}")
            print(f"      Issue: {issue['message']}")
            print(f"      Fix: {issue['fix']}")
    
    # Summary
    print(f"\n{'='*60}")
    if total_issues == 0:
        print("✅ All files passed accessibility checks!")
        sys.exit(0)
    else:
        critical_count = sum(r['critical'] for r in results)
        high_count = sum(r['high'] for r in results)
        print(f"⚠️  Found {total_issues} issues across {total_files} files")
        print(f"   Critical: {critical_count}, High: {high_count}")
        if critical_count > 0 or high_count > 0:
            sys.exit(1)
        sys.exit(0)


if __name__ == '__main__':
    main()
