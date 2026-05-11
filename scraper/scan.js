#!/usr/bin/env node
// scan.js — Sunray Flooring Daily Contract Scanner
// Scrapes Charleston County and City of Charleston procurement pages,
// extracts contract text, runs risk analysis, and writes data/results.json.

const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');
const { analyzeText } = require('./analyzer');

// ─── helpers ────────────────────────────────────────────────────────────────

function fetchUrl(url, redirects = 0) {
  return new Promise((resolve, reject) => {
    if (redirects > 5) return reject(new Error('Too many redirects'));
    const lib = url.startsWith('https') ? https : http;
    const req = lib.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; SunrayContractScanner/1.0; +https://sunrayflooring.com)',
        'Accept': 'text/html,application/xhtml+xml,application/pdf,*/*',
      },
      timeout: 20000,
    }, (res) => {
      if ([301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location) {
        const next = res.headers.location.startsWith('http')
          ? res.headers.location
          : new URL(res.headers.location, url).href;
        return resolve(fetchUrl(next, redirects + 1));
      }
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => resolve({ body: Buffer.concat(chunks), contentType: res.headers['content-type'] || '', statusCode: res.statusCode }));
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('Request timed out')); });
  });
}

function stripHtml(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ').replace(/&#\d+;/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

// Very basic PDF text extraction without external deps (reads raw text streams)
function extractPdfText(buffer) {
  try {
    const str = buffer.toString('binary');
    const textChunks = [];
    // Extract text between BT (begin text) and ET (end text) markers
    const btEtRegex = /BT([\s\S]*?)ET/g;
    let match;
    while ((match = btEtRegex.exec(str)) !== null) {
      const block = match[1];
      // Extract strings in parentheses
      const parenRegex = /\(((?:[^()\\]|\\.)*)\)/g;
      let pm;
      while ((pm = parenRegex.exec(block)) !== null) {
        const t = pm[1].replace(/\\(\d{3})/g, (_, o) => String.fromCharCode(parseInt(o, 8)))
                       .replace(/\\n/g, '\n').replace(/\\r/g, '\r').replace(/\\t/g, '\t')
                       .replace(/\\\\/g, '\\').replace(/\\(.)/g, '$1');
        if (t.trim().length > 1) textChunks.push(t);
      }
    }
    return textChunks.join(' ').replace(/\s+/g, ' ').trim();
  } catch {
    return '';
  }
}

function slugify(str) {
  return str.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60);
}

// ─── scrapers ────────────────────────────────────────────────────────────────

async function scrapeCityOfCharleston() {
  const listings = [];
  console.log('  Fetching City of Charleston bids…');
  try {
    const res = await fetchUrl('https://www.charleston-sc.gov/Bids.aspx');
    const html = res.body.toString('utf8');

    // CivicPlus/CivicEngage pattern: bid rows contain title, dates, links
    const rowRegex = /<tr[^>]*class="[^"]*(?:tableRow|BidRow|row)[^"]*"[^>]*>([\s\S]*?)<\/tr>/gi;
    const linkRegex = /<a[^>]+href="([^"]*(?:View|Detail|Bid)[^"]*)"[^>]*>([^<]+)<\/a>/i;
    const dateRegex = /(\d{1,2}\/\d{1,2}\/\d{4})/;

    // Broader fallback: look for all bid-related links
    const allLinks = [];
    const bidLinkRegex = /<a[^>]+href="(\/(?:Bids|DocumentCenter)[^"]*)"[^>]*>([^<]{10,120})<\/a>/gi;
    let lm;
    while ((lm = bidLinkRegex.exec(html)) !== null) {
      const href = lm[1];
      const title = lm[2].replace(/\s+/g, ' ').trim();
      if (title.length > 10 && !title.includes('javascript')) {
        allLinks.push({ href: `https://www.charleston-sc.gov${href}`, title });
      }
    }

    // De-duplicate by href
    const seen = new Set();
    for (const link of allLinks) {
      if (!seen.has(link.href)) {
        seen.add(link.href);
        const dateMatch = html.match(dateRegex);
        listings.push({
          source: 'City of Charleston',
          title: link.title,
          url: link.href,
          datePosted: dateMatch ? dateMatch[1] : new Date().toLocaleDateString('en-US'),
        });
      }
    }

    // If we didn't find structured links, try a simpler pattern
    if (listings.length === 0) {
      const simpleLinks = /<a[^>]+href="([^"]*Bid[^"]*)"[^>]*>\s*([^<]{5,})\s*<\/a>/gi;
      while ((lm = simpleLinks.exec(html)) !== null) {
        const title = lm[2].trim();
        const href = lm[1].startsWith('http') ? lm[1] : `https://www.charleston-sc.gov${lm[1]}`;
        if (!seen.has(href)) {
          seen.add(href);
          listings.push({ source: 'City of Charleston', title, url: href, datePosted: new Date().toLocaleDateString('en-US') });
        }
      }
    }

    console.log(`  Found ${listings.length} City of Charleston listings`);
  } catch (e) {
    console.error('  City of Charleston scrape error:', e.message);
  }
  return listings.slice(0, 20); // cap at 20 most recent
}

async function scrapeCharlestonCounty() {
  const listings = [];
  console.log('  Fetching Charleston County procurement…');
  try {
    const res = await fetchUrl('https://www.charlestoncounty.org/departments/procurement/index.php');
    const html = res.body.toString('utf8');

    // Look for bid/RFP/IFB links
    const linkRegex = /<a[^>]+href="([^"]*(?:bid|rfp|rfq|contract|procurement)[^"]*)"[^>]*>([^<]{5,120})<\/a>/gi;
    const seen = new Set();
    let lm;
    while ((lm = linkRegex.exec(html)) !== null) {
      const rawHref = lm[1];
      const title = lm[2].replace(/\s+/g, ' ').trim();
      if (title.length < 5) continue;
      const href = rawHref.startsWith('http') ? rawHref
        : rawHref.startsWith('/') ? `https://www.charlestoncounty.org${rawHref}`
        : `https://www.charlestoncounty.org/departments/procurement/${rawHref}`;
      if (!seen.has(href)) {
        seen.add(href);
        listings.push({ source: 'Charleston County', title, url: href, datePosted: new Date().toLocaleDateString('en-US') });
      }
    }

    // Also grab any PDF links on the page
    const pdfRegex = /<a[^>]+href="([^"]*\.pdf)"[^>]*>([^<]{5,120})<\/a>/gi;
    while ((lm = pdfRegex.exec(html)) !== null) {
      const rawHref = lm[1];
      const title = lm[2].replace(/\s+/g, ' ').trim();
      const href = rawHref.startsWith('http') ? rawHref : `https://www.charlestoncounty.org${rawHref}`;
      if (!seen.has(href)) {
        seen.add(href);
        listings.push({ source: 'Charleston County', title, url: href, datePosted: new Date().toLocaleDateString('en-US') });
      }
    }

    console.log(`  Found ${listings.length} Charleston County listings`);
  } catch (e) {
    console.error('  Charleston County scrape error:', e.message);
  }
  return listings.slice(0, 20);
}

// ─── fetch and analyze a single contract ─────────────────────────────────────

async function analyzeContract(listing) {
  let text = `${listing.title} ${listing.description || ''}`;

  try {
    console.log(`    Fetching: ${listing.url}`);
    const res = await fetchUrl(listing.url);
    const ct = res.contentType.toLowerCase();

    if (ct.includes('pdf')) {
      const extracted = extractPdfText(res.body);
      if (extracted.length > 100) text += ' ' + extracted;
    } else if (ct.includes('html') || ct.includes('text')) {
      const pageText = stripHtml(res.body.toString('utf8'));
      text += ' ' + pageText.slice(0, 8000); // cap at 8k chars

      // Look for any PDF links in the page and try to fetch the first one
      const pdfMatch = /<a[^>]+href="([^"]+\.pdf[^"]*)"[^>]*>/i.exec(res.body.toString('utf8'));
      if (pdfMatch) {
        const pdfUrl = pdfMatch[1].startsWith('http') ? pdfMatch[1]
          : `${new URL(listing.url).origin}${pdfMatch[1]}`;
        try {
          const pdfRes = await fetchUrl(pdfUrl);
          const pdfText = extractPdfText(pdfRes.body);
          if (pdfText.length > 100) text += ' ' + pdfText;
        } catch { /* best effort */ }
      }
    }
  } catch (e) {
    console.warn(`    Could not fetch contract body: ${e.message}`);
  }

  const analysis = analyzeText(text);

  return {
    id: `${slugify(listing.source)}-${slugify(listing.title)}-${Date.now()}`,
    title: listing.title,
    source: listing.source,
    url: listing.url,
    dateFound: new Date().toISOString().split('T')[0],
    datePosted: listing.datePosted,
    isFlooringRelevant: analysis.isFlooringRelevant,
    grade: analysis.grade,
    counts: analysis.counts,
    findings: analysis.findings,
  };
}

// ─── main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`\n🔍 Sunray Contract Scanner — ${new Date().toLocaleString('en-US', { timeZone: 'America/New_York' })} EST\n`);

  // Load existing results to avoid re-analyzing contracts we've already seen
  const resultsPath = path.join(__dirname, '..', 'data', 'results.json');
  let existing = { contracts: [] };
  try {
    existing = JSON.parse(fs.readFileSync(resultsPath, 'utf8'));
  } catch { /* first run */ }

  const existingUrls = new Set((existing.contracts || []).map(c => c.url));

  // Scrape both sources
  const [cityListings, countyListings] = await Promise.all([
    scrapeCityOfCharleston(),
    scrapeCharlestonCounty(),
  ]);

  const allListings = [...cityListings, ...countyListings];
  const newListings = allListings.filter(l => !existingUrls.has(l.url));
  console.log(`\n📋 ${allListings.length} listings found, ${newListings.length} new\n`);

  // Analyze new contracts
  const newContracts = [];
  for (const listing of newListings.slice(0, 15)) { // cap at 15 new per run
    try {
      console.log(`  Analyzing: ${listing.title}`);
      const result = await analyzeContract(listing);
      newContracts.push(result);
      // Small delay to be polite to government servers
      await new Promise(r => setTimeout(r, 1500));
    } catch (e) {
      console.error(`  Failed to analyze ${listing.title}: ${e.message}`);
    }
  }

  // Merge: new contracts first, keep last 120 days of existing
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 120);
  const keptExisting = (existing.contracts || []).filter(c => new Date(c.dateFound) > cutoff);

  const allContracts = [...newContracts, ...keptExisting];

  // Build summary stats
  const totalHigh = allContracts.filter(c => c.grade === 'D' || c.counts?.HIGH >= 2).length;
  const flooringRelevant = allContracts.filter(c => c.isFlooringRelevant).length;

  const output = {
    lastUpdated: new Date().toISOString(),
    scanSources: ['City of Charleston', 'Charleston County'],
    totalContracts: allContracts.length,
    newThisScan: newContracts.length,
    flooringRelevant,
    highRiskContracts: totalHigh,
    contracts: allContracts,
  };

  fs.mkdirSync(path.dirname(resultsPath), { recursive: true });
  fs.writeFileSync(resultsPath, JSON.stringify(output, null, 2));
  console.log(`\n✅ Saved ${allContracts.length} contracts to data/results.json`);
  console.log(`   ${newContracts.length} new | ${flooringRelevant} flooring-relevant | ${totalHigh} high-risk\n`);
}

main().catch(e => { console.error('Fatal:', e); process.exit(1); });
