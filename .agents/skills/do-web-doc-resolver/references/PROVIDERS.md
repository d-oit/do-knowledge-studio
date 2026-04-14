# Providers Reference

## Overview

The resolver supports multiple providers for both URL resolution and query resolution. Providers are tried in a free-first cascade.

## Provider Types

| Type | Description | Input |
|------|-------------|-------|
| **URL** | Fetches content from a URL | URL string |
| **Query** | Searches for information | Query string |

## URL Providers

### llms_txt (FREE)

**Type**: URL
**Free**: Yes
**API Key**: Not required

Fetches the standardized `/llms.txt` file from websites.

```bash
# Example
https://example.com/llms.txt
```

**Pros**:
- Structured, LLM-optimized content
- No rate limits
- High quality signal

**Cons**:
- Only available on participating sites
- Limited coverage

### Jina Reader (FREE)

**Type**: URL
**Free**: Yes
**API Key**: Not required

Uses Jina's free reader API to extract content.

```bash
# API endpoint
https://r.jina.ai/{url}
```

**Pros**:
- Works on most websites
- Good for static content
- No API key needed

**Cons**:
- May struggle with JS-heavy pages
- Rate limited (generous limits)

### Firecrawl (PAID)

**Type**: URL
**Free**: Limited tier
**API Key**: `FIRECRAWL_API_KEY`

Deep extraction with JavaScript rendering.

**Pros**:
- Handles JS-heavy pages
- Good for SPAs
- Clean markdown output

**Cons**:
- Paid after free tier
- Slower than Jina

### Direct Fetch (FREE)

**Type**: URL
**Free**: Yes
**API Key**: Not required

Simple HTTP GET with HTML-to-text extraction.

**Pros**:
- Always available
- Fast
- No rate limits

**Cons**:
- No JS rendering
- Basic extraction only
- May miss dynamic content

### Mistral Browser (PAID)

**Type**: URL
**Free**: No
**API Key**: `MISTRAL_API_KEY`

AI-powered browser agent for complex pages.

**Pros**:
- Handles any page type
- AI extraction
- Good for complex layouts

**Cons**:
- Paid only
- Higher latency

### Docling (FREE)

**Type**: URL
**Free**: Yes
**API Key**: Not required

Document processing for PDFs, DOCX, PPTX.

**Trigger**: URLs ending in `.pdf`, `.docx`, `.pptx`

**Requirements**: `docling` CLI installed

```bash
pip install docling
```

### OCR (FREE)

**Type**: URL
**Free**: Yes
**API Key**: Not required

Text extraction from images.

**Trigger**: URLs ending in `.png`, `.jpg`, `.jpeg`

**Requirements**: `tesseract` installed

```bash
# Ubuntu/Debian
sudo apt install tesseract-ocr

# macOS
brew install tesseract
```

## Query Providers

### Exa MCP (FREE)

**Type**: Query
**Free**: Yes
**API Key**: Not required

Exa's MCP server for web search.

**Pros**:
- Free, no API key
- Good quality results
- Structured output

**Cons**:
- Rate limited
- May be unavailable at times

### Exa SDK (PAID)

**Type**: Query
**Free**: Limited tier
**API Key**: `EXA_API_KEY`

Official Exa API with highlights.

**Pros**:
- High quality results
- Autoprompt feature
- Highlights extraction

**Cons**:
- Paid after free tier
- Requires API key

### Tavily (PAID)

**Type**: Query
**Free**: Limited tier
**API Key**: `TAVILY_API_KEY`

Comprehensive search API.

**Pros**:
- Good coverage
- Structured results
- Search depth options

**Cons**:
- Paid after free tier
- Requires API key

### Serper (PAID)

**Type**: Query
**Free**: 2500 credits
**API Key**: `SERPER_API_KEY`

Google search via Serper API.

**Pros**:
- Google results
- Fast
- 2500 free credits

**Cons**:
- Paid after credits
- Requires API key

### DuckDuckGo (FREE)

**Type**: Query
**Free**: Yes
**API Key**: Not required

DuckDuckGo instant answers.

**Pros**:
- Always free
- No API key needed
- Good fallback

**Cons**:
- Limited result quality
- Fewer results than paid providers

### Mistral Web Search (PAID)

**Type**: Query
**Free**: No
**API Key**: `MISTRAL_API_KEY`

AI-powered web search via Mistral.

**Pros**:
- AI-synthesized results
- Good for complex queries

**Cons**:
- Paid only
- Higher latency

## Rate Limits

| Provider | Rate Limit | Notes |
|----------|------------|-------|
| Exa MCP | Unknown | May vary |
| Exa SDK | Varies by plan | Check your plan |
| Tavily | Varies by plan | Check your plan |
| Serper | 2500/month free | Then paid |
| Jina | Generous | 429 triggers cooldown |
| Firecrawl | Varies by plan | Check your plan |
| DuckDuckGo | Moderate | Be respectful |
| Mistral | Varies by plan | Check your plan |

## Error Handling

| Error Type | Detection | Behavior |
|------------|-----------|----------|
| `rate_limit` | 429, "rate limit" | Set cooldown, skip provider |
| `auth_error` | 401, 403, "unauthorized" | Log error, skip provider |
| `quota_exhausted` | 402, "quota", "credits" | Log warning, skip provider |
| `network_error` | "timeout", "connection" | Log error, skip provider |
| `not_found` | 404, "not found" | Log error, skip provider |
| `provider_5xx` | 500-504 | Trip circuit breaker |

## Provider Selection

Providers are selected based on:

1. **Input type**: URL vs Query
2. **Budget constraints**: Profile settings
3. **Skip list**: Explicitly skipped providers
4. **Circuit breaker**: Provider health
5. **Routing memory**: Historical performance

### Example Selection Flow

```
Query: "Rust async runtime"
Profile: balanced

1. Cache check → Miss
2. Exa MCP → Try (free, first)
3. If quality < 0.65: Continue
4. Exa SDK → Try if API key + budget allows
5. If quality < 0.65: Continue
6. Tavily → Try if API key + budget allows
7. ...
8. DuckDuckGo → Always available fallback
```