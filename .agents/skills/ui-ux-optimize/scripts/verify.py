#!/usr/bin/env python3
"""ui-ux-optimize browser verification v2 — critical pair overlap detection"""
import json
import sys
from pathlib import Path
from playwright.sync_api import sync_playwright

VIEWPORTS = [
    {"name": "mobile-375",   "width": 375,  "height": 812},
    {"name": "tablet-768",   "width": 768,  "height": 1024},
    {"name": "desktop-1024", "width": 1024, "height": 768},
    {"name": "wide-1440",    "width": 1440, "height": 900},
]

CRITICAL_PAIRS = [
    ("[data-role='hud']", "[data-role='nav']",   "HUD vs bottom nav"),
    ("[data-role='hud']", ".fixed-cta",           "HUD vs fixed CTA"),
    ("[data-role='nav']", ".fixed-cta",           "bottom nav vs fixed CTA"),
    ("[data-role='nav']", ".card",                "nav vs card"),
    (".xp-card",          "[data-role='nav']",    "XP card vs nav"),
]

def boxes_overlap(a, b):
    return (a["x"] < b["x"] + b["width"] and a["x"] + a["width"] > b["x"] and
            a["y"] < b["y"] + b["height"] and a["y"] + a["height"] > b["y"])

def run_verification(html_path, output_dir):
    Path(output_dir).mkdir(parents=True, exist_ok=True)
    html = Path(html_path).read_text()
    results = {"screenshots": [], "overlap_issues": [], "nav_wrapping": {},
               "tap_target_failures": [], "horizontal_scroll": {}, "summary": {}}
    with sync_playwright() as p:
        browser = p.chromium.launch()
        for vp in VIEWPORTS:
            page = browser.new_page(viewport={"width": vp["width"], "height": vp["height"]})
            page.set_content(html, wait_until="domcontentloaded")
            page.wait_for_timeout(300)
            modal = page.query_selector("#modal")
            if modal:
                page.evaluate("document.getElementById('modal').style.display='none'")
            shot = f"{output_dir}/{vp['name']}.png"
            page.screenshot(path=shot, full_page=True)
            results["screenshots"].append(shot)
            if vp["name"] == "mobile-375" and modal:
                page.evaluate("document.getElementById('modal').style.display='flex'")
                ms = f"{output_dir}/mobile-375-modal.png"
                page.screenshot(path=ms)
                results["screenshots"].append(ms)
                page.evaluate("document.getElementById('modal').style.display='none'")
            for sa, sb, desc in CRITICAL_PAIRS:
                ea, eb = page.query_selector(sa), page.query_selector(sb)
                if not ea or not eb: continue
                try:
                    ba, bb = ea.bounding_box(), eb.bounding_box()
                    if ba and bb and ba["width"] > 0 and bb["width"] > 0:
                        if boxes_overlap(ba, bb):
                            results["overlap_issues"].append({"viewport": vp["name"], "pair": desc})
                except: pass
            nav = page.query_selector("[data-role='nav']")
            if nav:
                items = nav.query_selector_all("button, a")
                if len(items) >= 2:
                    try:
                        ys = [it.bounding_box()["y"] for it in items]
                        wrapped = sum(1 for y in ys if abs(y - ys[0]) > 6)
                        results["nav_wrapping"][vp["name"]] = {"status": "FAIL" if wrapped else "PASS", "items": len(items), "wrapped": wrapped}
                    except: pass
            if vp["width"] <= 768:
                for el in page.query_selector_all("button, a, [role='button']"):
                    try:
                        b = el.bounding_box()
                        if b and b["width"] > 0 and (b["width"] < 44 or b["height"] < 44):
                            results["tap_target_failures"].append({"viewport": vp["name"], "element": (el.inner_text() or "").strip()[:25] or "(icon)", "w": round(b["width"]), "h": round(b["height"])})
                    except: pass
            sw = page.evaluate("document.documentElement.scrollWidth")
            results["horizontal_scroll"][vp["name"]] = {"status": "FAIL" if sw > vp["width"] + 2 else "PASS", "content_width": sw, "viewport_width": vp["width"]}
            page.close()
        browser.close()
    nf = [k for k, v in results["nav_wrapping"].items() if v.get("status") == "FAIL"]
    sf = [k for k, v in results["horizontal_scroll"].items() if v.get("status") == "FAIL"]
    results["summary"] = {"screenshots": len(results["screenshots"]), "overlap": len(results["overlap_issues"]),
        "nav_wrap_fails": nf, "tap_fails": len(results["tap_target_failures"]), "scroll_fails": sf,
        "overall": "PASS" if not results["overlap_issues"] and not nf and not sf else "FAIL"}
    Path(f"{output_dir}/verification-report.json").write_text(json.dumps(results, indent=2))
    return results

if __name__ == "__main__":
    html = sys.argv[1] if len(sys.argv) > 1 else "prototype.html"
    out = sys.argv[2] if len(sys.argv) > 2 else "screenshots"
    r = run_verification(html, out)
    print(json.dumps(r["summary"], indent=2))
