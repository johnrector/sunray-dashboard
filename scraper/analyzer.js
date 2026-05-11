// analyzer.js — Sunray Flooring GC Contract Risk Engine
// Runs in Node.js (GitHub Actions scraper) and mirrors the browser tool logic.

const RULES = [
  // ── PAYMENT ─────────────────────────────────────────────────────────────
  {
    id: 'pay_if_paid',
    category: 'Payment',
    title: 'Pay-If-Paid Clause',
    risk: 'HIGH',
    subtitle: 'Payment is contingent on GC receiving funds from Owner',
    patterns: [
      /pay(?:ment)?\s+(?:is\s+)?(?:expressly\s+)?condition(?:ed)?\s+upon/i,
      /pay\s+if\s+paid/i,
      /condition\s+precedent\s+to\s+payment/i,
      /only\s+(?:upon|after|when)\s+(?:general\s+contractor(?:'s)?|GC(?:'s)?|contractor(?:'s)?)\s+receipt\s+of\s+payment/i,
      /receipt\s+of\s+payment\s+from\s+(?:owner|client)/i,
    ],
    explain: 'A pay-if-paid clause makes your right to payment entirely contingent on the GC receiving payment from the Owner. If the Owner doesn\'t pay — for any reason — you get nothing, even if your flooring work was perfect.',
    scNote: 'South Carolina courts enforce clearly-written pay-if-paid clauses as a complete defense to payment. Cite: Shelco, Inc. v. Alanthus Corp.',
    counter: 'Strike or replace with: "Payment to Subcontractor is not contingent upon General Contractor\'s receipt of payment from Owner. In no event shall payment be delayed more than 45 days from Subcontractor\'s invoice date."',
    actions: [
      'Strike this clause or replace with a pay-when-paid provision with a 45-day backstop',
      'Price the job 5–10% higher to account for payment risk if clause cannot be removed',
      'Request a personal guarantee from the GC principal',
    ],
  },
  {
    id: 'pay_when_paid',
    category: 'Payment',
    title: 'Pay-When-Paid Clause',
    risk: 'MEDIUM',
    subtitle: 'Payment timing tied to GC receiving funds — delay risk',
    patterns: [
      /pay\s+when\s+paid/i,
      /paid\s+within\s+\d+\s+days\s+(?:of|after|following)\s+(?:receipt|payment|owner)/i,
      /payment\s+receipt\s+from\s+owner/i,
    ],
    explain: 'A pay-when-paid clause delays your payment until the GC receives funds — it\'s a timing mechanism, not a permanent condition. However, without a hard backstop date, delays can drag on.',
    scNote: 'Under SC Prompt Payment Act (§29-6-230), subcontractors must receive payment within 7 days of the GC\'s receipt of payment. Longer delays may conflict with this statute.',
    counter: 'Add: "Payment shall in no event be delayed more than 45 calendar days from Subcontractor\'s invoice, regardless of whether GC has received payment from Owner."',
    actions: [
      'Negotiate a 45-day maximum backstop from invoice date',
      'Add interest at 1.5%/month for late payments',
    ],
  },

  // ── INDEMNIFICATION ──────────────────────────────────────────────────────
  {
    id: 'broad_indemnity',
    category: 'Indemnification',
    title: 'Broad Indemnification — Potentially Void Under SC Law',
    risk: 'HIGH',
    subtitle: 'May require covering GC\'s own negligence — illegal in SC',
    patterns: [
      /indemnif(?:y|ication|ied)\s+.*(?:general\s+contractor|GC|contractor|indemnitee)/i,
      /hold\s+harmless\s+.*(?:general\s+contractor|GC|contractor|owner)/i,
      /protect,\s*defend,?\s+and\s+hold\s+harmless/i,
      /any\s+and\s+all\s+claims.*arising\s+(?:out\s+of|from)/i,
      /save\s+harmless/i,
    ],
    explain: 'Broad indemnification clauses attempt to shift ALL liability to you — including claims caused by the GC\'s own negligence. You could be required to pay all their legal costs even when the GC was at fault.',
    scNote: 'S.C. Code § 32-2-10 (Anti-Indemnity Statute) voids any construction contract provision requiring a subcontractor to indemnify the GC for the GC\'s OWN negligence. However, you can be required to indemnify for your own negligence.',
    counter: 'Replace with: "Subcontractor\'s indemnity is limited to claims arising from Subcontractor\'s own negligence or willful misconduct, per S.C. Code § 32-2-10."',
    actions: [
      'Cite SC § 32-2-10 — broad indemnity is void in SC regardless',
      'Demand mutual indemnification (each party covers their own negligence)',
      'Remove any language covering the GC\'s own negligence',
    ],
  },
  {
    id: 'consequential_damages',
    category: 'Indemnification',
    title: 'Consequential / Liquidated Damages Exposure',
    risk: 'HIGH',
    subtitle: 'Could expose Sunray to lost profits or per-day delay penalties',
    patterns: [
      /consequential\s+damages/i,
      /liquidated\s+damages/i,
      /delay\s+damages/i,
      /\$\d+(?:,\d{3})*\s+per\s+(?:day|week)\s+(?:for\s+)?(?:delay|liquidated)/i,
    ],
    explain: 'Liquidated or consequential damages clauses can result in massive liability — potentially more than your entire subcontract value — for a single delay on your part.',
    scNote: 'SC courts enforce liquidated damage clauses if the agreed amount is a reasonable estimate of actual damages, not a penalty. Document all delays caused by others immediately.',
    counter: 'Add: "Subcontractor shall not be liable for consequential damages. Liquidated damages apply only to delays solely caused by Subcontractor. Maximum aggregate liability shall not exceed the total subcontract value."',
    actions: [
      'Cap total liability at the subcontract amount',
      'Add mutual waiver of consequential damages',
      'Document all predecessor-trade delays in writing',
    ],
  },

  // ── LIEN WAIVERS ─────────────────────────────────────────────────────────
  {
    id: 'unconditional_lien_waiver',
    category: 'Lien Waivers',
    title: 'Unconditional Lien Waiver Required',
    risk: 'HIGH',
    subtitle: 'Waiving lien rights BEFORE receiving payment is extremely risky',
    patterns: [
      /unconditional\s+lien\s+(?:waiver|release)/i,
      /lien\s+waiver.*prior\s+to\s+(?:payment|receipt)/i,
      /release\s+of\s+all\s+lien\s+rights/i,
      /unconditionally\s+(?:waive|release)\s+(?:any|all)\s+(?:lien|mechanic)/i,
    ],
    explain: 'An unconditional lien waiver permanently releases your right to file a mechanics\' lien the moment you sign it — even if you haven\'t been paid. If the check bounces after you sign, you\'ve lost your most powerful collection tool.',
    scNote: 'Under SC Mechanics\' Lien Law (§29-5-10 et seq.), always use CONDITIONAL lien waivers effective only upon actual receipt of cleared funds.',
    counter: 'Require: "Any lien waiver shall be CONDITIONAL, effective solely upon Subcontractor\'s actual receipt and clearance of the specified payment."',
    actions: [
      'NEVER sign an unconditional lien waiver until the check has cleared your bank',
      'Use only conditional lien waivers tied to specific payment amounts',
      'Track the 90-day SC lien filing deadline from last day of work',
    ],
  },

  // ── CHANGE ORDERS ─────────────────────────────────────────────────────────
  {
    id: 'no_damages_delay',
    category: 'Change Orders',
    title: 'No Damages for Delay Clause',
    risk: 'HIGH',
    subtitle: 'GC can delay your work with no financial compensation',
    patterns: [
      /no\s+(?:damages|compensation|additional\s+cost)\s+for\s+delay/i,
      /sole\s+remedy\s+for\s+delay.*extension\s+of\s+time/i,
      /time\s+extension.*only\s+remedy/i,
      /subcontractor\s+shall\s+not\s+be\s+entitled\s+to\s+(?:additional\s+)?(?:compensation|damages|costs)\s+(?:for|due\s+to)\s+delay/i,
    ],
    explain: 'Even if the GC\'s mismanagement idles your crew for weeks, your only remedy is more time — not money. For flooring contractors who mobilize specialized crews, this can be devastating.',
    scNote: 'SC recognizes exceptions for active interference, bad faith, and unreasonable delay. Document all GC-caused delays with dated written notices.',
    counter: 'Negotiate: "No-damages-for-delay shall not apply to: (a) GC\'s active interference; (b) delays exceeding 14 consecutive days; (c) remobilization costs."',
    actions: [
      'Price your bid with a delay contingency',
      'Document every delay immediately in writing to the GC',
      'Request the construction schedule before signing',
    ],
  },
  {
    id: 'written_co_only',
    category: 'Change Orders',
    title: 'Written Change Order Requirement',
    risk: 'MEDIUM',
    subtitle: 'Verbal field instructions may not be compensable',
    patterns: [
      /(?:no|any)\s+(?:additional\s+)?(?:compensation|payment)\s+(?:without|unless)\s+(?:prior\s+)?written/i,
      /change\s+order\s+must\s+be\s+(?:in\s+writing|written|executed)/i,
      /extra\s+work.*written\s+authorization/i,
      /written\s+change\s+order\s+prior\s+to\s+(?:commencing|performing)/i,
    ],
    explain: 'Any verbal instruction from a GC superintendent to do additional work may not be compensable without a prior written change order. In flooring, extra work often happens in the field.',
    scNote: 'SC courts enforce written change order requirements strictly in commercial construction contracts.',
    counter: 'Add: "GC failure to respond within 5 business days to Subcontractor\'s written change notice constitutes deemed approval."',
    actions: [
      'Create a field change authorization form — get GC super signature before starting extra work',
      'Follow every verbal instruction with a same-day email confirmation',
    ],
  },

  // ── RETAINAGE ─────────────────────────────────────────────────────────────
  {
    id: 'retainage_10',
    category: 'Retainage',
    title: '10% Retainage',
    risk: 'MEDIUM',
    subtitle: 'High retainage ties up significant cash flow',
    patterns: [
      /retain(?:age)?\s+of\s+(?:ten|10)\s*%/i,
      /10%\s+(?:retainage|retainage\s+withheld|held)/i,
      /withhold\s+10(?:\.\d+)?%/i,
      /retain\s+ten\s+percent/i,
    ],
    explain: '10% retainage on a $200,000 job means $20,000 sitting with the GC, potentially for months. This creates serious cash flow problems.',
    scNote: 'SC Code § 11-35-3030 limits retainage on public projects to 6%, reducing to 2% after 50% completion. Push for same on private work.',
    counter: 'Negotiate: "Retainage shall not exceed 5%. Upon Subcontractor\'s substantial completion, retainage reduces to 2%. Final retainage released within 30 days of punch-list completion."',
    actions: [
      'Negotiate retainage to 5% maximum',
      'Decouple your retainage release from overall project completion',
    ],
  },

  // ── NOTICE REQUIREMENTS ───────────────────────────────────────────────────
  {
    id: 'short_notice_window',
    category: 'Notice Requirements',
    title: 'Short Notice Window for Claims',
    risk: 'HIGH',
    subtitle: 'Missing notice deadlines can void legitimate claims',
    patterns: [
      /(?:written\s+)?notice\s+within\s+(?:24|48|72)\s+hours/i,
      /notice\s+within\s+[1-3]\s+(?:business\s+)?days/i,
      /failure\s+to\s+provide\s+(?:timely\s+)?notice.*(?:waive|forfeit|void)/i,
      /claims?\s+.*notice\s+within\s+(?:twenty-one|21)\s+days/i,
    ],
    explain: 'Very short notice windows mean that if you\'re busy in the field and miss a 24–48 hour deadline, you may forfeit a legitimate claim entirely.',
    scNote: 'SC courts enforce contractual notice provisions strictly. Do not rely on waiver defenses — give written notice every time.',
    counter: 'Negotiate: "Notice periods shall be no less than 7 business days. Failure to provide timely notice shall not bar a claim if GC had actual knowledge."',
    actions: [
      'Assign one person to track and send all written notices',
      'Send notices via email with read receipt AND certified mail',
    ],
  },

  // ── TERMINATION ───────────────────────────────────────────────────────────
  {
    id: 'termination_convenience',
    category: 'Termination',
    title: 'Termination for Convenience — Profit Recovery Risk',
    risk: 'HIGH',
    subtitle: 'GC can terminate at any time, cutting off your anticipated profit',
    patterns: [
      /terminat(?:e|ion)\s+(?:for|at)\s+convenience/i,
      /(?:general\s+contractor|GC)\s+may\s+terminat(?:e|ion)\s+(?:this\s+)?(?:agreement|contract|subcontract)\s+(?:at\s+any\s+time|without\s+cause)/i,
      /terminat(?:e|ion)\s+at\s+(?:any\s+time|will|sole\s+discretion)/i,
    ],
    explain: 'Termination for convenience lets the GC cancel your contract at any time for any reason. Many such clauses limit recovery to work performed, cutting off your profit on unfinished work.',
    scNote: 'SC courts enforce termination for convenience clauses. You are typically entitled to cost of work performed, materials ordered, and overhead — but not anticipated profit unless the contract says so.',
    counter: 'Add: "Upon convenience termination, Subcontractor shall receive: (a) all work performed; (b) materials purchased; (c) reasonable demobilization; (d) 15% overhead and profit on unperformed work. Minimum 14 days written notice required."',
    actions: [
      'Negotiate profit recovery (10–15%) on unperformed work',
      'Require 14-day minimum notice before convenience termination',
    ],
  },

  // ── INSURANCE ─────────────────────────────────────────────────────────────
  {
    id: 'additional_insured',
    category: 'Insurance',
    title: 'Additional Insured Requirement',
    risk: 'INFO',
    subtitle: 'GC and Owner named on your policy — verify coverage',
    patterns: [
      /additional\s+insured/i,
      /named\s+as\s+(?:an\s+)?additional\s+insured/i,
    ],
    explain: 'Standard practice, but you need to confirm your insurer will add them and understand any premium costs.',
    scNote: 'Additional insured status must be endorsed explicitly. "Primary and non-contributory" means YOUR policy pays first.',
    counter: 'Action required: Call your insurance broker before signing to confirm the endorsement and any added premium.',
    actions: [
      'Call your insurance broker before signing',
      'Obtain the COI and additional insured endorsement before starting work',
    ],
  },
  {
    id: 'waiver_subrogation',
    category: 'Insurance',
    title: 'Waiver of Subrogation Required',
    risk: 'LOW',
    subtitle: 'Insurer cannot sue GC after paying your claim',
    patterns: [
      /waiver\s+of\s+subrogation/i,
      /waive\s+(?:all\s+)?(?:rights\s+of\s+)?subrogation/i,
    ],
    explain: 'Common and generally acceptable. Prevents your insurer from suing the GC to recover money they paid you.',
    scNote: 'Most standard SC policies permit waiver of subrogation by endorsement. Confirm with your broker before work begins.',
    counter: 'Acceptable standard provision. Notify your broker to add the endorsement before mobilizing.',
    actions: [
      'Notify your broker — usually no or minimal added cost',
      'Confirm the waiver covers both CGL and Workers\' Comp',
    ],
  },

  // ── DISPUTE RESOLUTION ────────────────────────────────────────────────────
  {
    id: 'unfavorable_venue',
    category: 'Dispute Resolution',
    title: 'Out-of-State Venue / Governing Law',
    risk: 'HIGH',
    subtitle: 'Requires litigating in another state — massive added cost',
    patterns: [
      /governing\s+law.*(?!South\s+Carolina|charleston)(?:state\s+of\s+)?[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\s+law/i,
      /(?:courts?\s+of|jurisdiction\s+in|venue\s+in)\s+(?!South\s+Carolina|charleston|columbia|greenville)[A-Z][a-z]+/i,
    ],
    explain: 'If disputes must be filed in another state, you face out-of-state attorneys, travel costs, and unfamiliar courts — easily adding $30,000–$50,000 to any dispute.',
    scNote: 'Insist on SC governing law. SC provides anti-indemnity, prompt payment, and mechanics\' lien protections you would lose under another state\'s law.',
    counter: 'Require: "This Agreement shall be governed by SC law. Disputes shall be resolved exclusively in Charleston County, SC courts."',
    actions: [
      'Never agree to litigate outside South Carolina for SC construction work',
      'Specify Charleston County as venue',
    ],
  },
  {
    id: 'arbitration',
    category: 'Dispute Resolution',
    title: 'Mandatory Arbitration',
    risk: 'MEDIUM',
    subtitle: 'No jury trial — disputes go to private arbitration',
    patterns: [
      /arbitrat(?:ion|e|ed)/i,
      /american\s+arbitration\s+association/i,
      /AAA\s+(?:construction|commercial)\s+rules/i,
      /JAMS\s+arbitration/i,
    ],
    explain: 'Arbitration can be faster for small disputes but arbitration fees can be steep for large claims, and the decision is final with limited appeal rights.',
    scNote: 'SC courts strongly enforce arbitration agreements. If you want to preserve the right to litigate, remove this clause.',
    counter: 'Negotiate: "Disputes under $50,000 may go to arbitration. Disputes over $50,000 shall be resolved in Charleston County courts with prevailing party entitled to attorney\'s fees."',
    actions: [
      'Negotiate a dollar threshold for arbitration vs. litigation',
      'If arbitration is kept, specify AAA Construction Rules and Charleston, SC location',
    ],
  },

  // ── FLOW-DOWN ─────────────────────────────────────────────────────────────
  {
    id: 'flow_down',
    category: 'Flow-Down',
    title: 'Broad Flow-Down / Prime Contract Incorporation',
    risk: 'HIGH',
    subtitle: 'You\'re bound by a contract you may not have seen',
    patterns: [
      /incorporat(?:ed|es?)\s+(?:by\s+reference|herein)\s+.*prime\s+contract/i,
      /subcontractor\s+(?:is\s+)?(?:bound\s+by|subject\s+to|assumes)\s+all\s+(?:terms|obligations)\s+of\s+the\s+(?:prime|general)\s+contract/i,
      /all\s+(?:terms|conditions|provisions)\s+of\s+the\s+prime\s+contract.*(?:apply|are\s+incorporated)/i,
      /flow(?:\s+|-)?down/i,
    ],
    explain: 'Flow-down clauses make you responsible for every obligation in the GC\'s contract with the Owner — a contract you almost certainly haven\'t read. Signing this blind is extremely risky.',
    scNote: 'SC courts enforce flow-down clauses. You are legally bound by prime contract terms even if you never received a copy.',
    counter: 'Require: "Subcontractor\'s obligations do not automatically incorporate all prime contract terms. GC shall provide a complete prime contract copy prior to execution."',
    actions: [
      'ALWAYS request and read the prime contract before signing — non-negotiable',
      'Limit flow-down to specific categories: safety, insurance, warranty only',
    ],
  },

  // ── WARRANTY ──────────────────────────────────────────────────────────────
  {
    id: 'extended_warranty',
    category: 'Warranty',
    title: 'Extended Warranty Period',
    risk: 'MEDIUM',
    subtitle: 'Warranty beyond 1-year industry standard',
    patterns: [
      /warrant(?:y|ies)?\s+(?:for|period\s+of)\s+(?:two|three|four|five|2|3|4|5)\s+years?/i,
      /warrant\s+the\s+work\s+for\s+a\s+period\s+of/i,
    ],
    explain: 'Standard flooring warranty is 1 year on workmanship. Longer warranties expose you to claims for issues caused by others — moisture, subfloor movement, other trades.',
    scNote: 'SC has a 3-year statute of limitations for contract claims and 8-year statute of repose for real property improvements (§15-3-640).',
    counter: 'Limit: "Subcontractor warrants workmanship for 1 year from substantial completion, provided flooring has not been subjected to abuse, improper maintenance, or abnormal moisture."',
    actions: [
      'Limit warranty to 1 year on workmanship',
      'Carve out conditions that void the warranty (moisture, subfloor movement, other trades)',
      'Keep project photos and pre-install moisture readings on file',
    ],
  },
];

// Keywords that make a contract particularly relevant to Sunray Flooring
const FLOORING_KEYWORDS = [
  /floor(?:ing)?/i, /carpet/i, /tile/i, /lvt/i, /vinyl/i, /hardwood/i,
  /laminate/i, /epoxy/i, /terrazzo/i, /subfloor/i, /underlayment/i,
  /resilient\s+flooring/i, /wood\s+floor/i, /ceramic/i, /porcelain/i,
];

function analyzeText(text) {
  const findings = [];
  for (const rule of RULES) {
    for (const pattern of rule.patterns) {
      const match = text.match(pattern);
      if (match) {
        const idx = text.search(pattern);
        const start = Math.max(0, idx - 100);
        const end = Math.min(text.length, idx + match[0].length + 180);
        let snippet = text.slice(start, end).replace(/\s+/g, ' ').trim();
        if (start > 0) snippet = '…' + snippet;
        if (end < text.length) snippet += '…';
        findings.push({
          id: rule.id,
          category: rule.category,
          title: rule.title,
          risk: rule.risk,
          subtitle: rule.subtitle,
          excerpt: snippet,
          explain: rule.explain,
          scNote: rule.scNote || null,
          counter: rule.counter,
          actions: rule.actions,
        });
        break; // one match per rule
      }
    }
  }

  const high = findings.filter(f => f.risk === 'HIGH').length;
  const medium = findings.filter(f => f.risk === 'MEDIUM').length;
  let grade;
  if (high >= 4) grade = 'D';
  else if (high >= 2) grade = 'C';
  else if (high === 1 || medium >= 3) grade = 'B';
  else grade = 'A';

  const isFlooringRelevant = FLOORING_KEYWORDS.some(kw => kw.test(text));

  return {
    grade,
    isFlooringRelevant,
    counts: {
      HIGH: findings.filter(f => f.risk === 'HIGH').length,
      MEDIUM: findings.filter(f => f.risk === 'MEDIUM').length,
      LOW: findings.filter(f => f.risk === 'LOW').length,
      INFO: findings.filter(f => f.risk === 'INFO').length,
    },
    findings,
  };
}

module.exports = { analyzeText };
