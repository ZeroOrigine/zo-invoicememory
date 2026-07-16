# Landing page escape-sequence fix (applied surgically to app/(marketing)/page.tsx)

Self-validation found five JSX TEXT nodes containing literal `\uXXXX` escape
sequences. JSX text does NOT interpret JavaScript escapes, so visitors would
see raw `\u201c` / `\u2019` characters on the marketing page. JS-string escapes
inside the data constants (FEATURES, STEPS, TIERS, TESTIMONIALS quotes, FAQS)
are interpreted correctly and were already fine.

The five broken JSX text nodes and their exact replacements (use real unicode
characters — lint-safe, unambiguous):

1. How-it-works `<h2>`:
   BEFORE: `From \u201csent\u201d to \u201cpaid\u201d — on autopilot.`
   AFTER:  `From “sent” to “paid” — on autopilot.`

2. Pricing intro `<p>`:
   BEFORE: `The free plan isn\u2019t a teaser — it\u2019s the full memory engine for lighter invoice volume. Upgrade only when the automation starts paying for itself.`
   AFTER:  `The free plan isn’t a teaser — it’s the full memory engine for lighter invoice volume. Upgrade only when the automation starts paying for itself.`

3. Testimonials intro `<p>`:
   BEFORE: `From solo freelancers to agency finance teams — here\u2019s what happens when invoices remember themselves.`
   AFTER:  `From solo freelancers to agency finance teams — here’s what happens when invoices remember themselves.`

4. Testimonial `<blockquote>` wrapper:
   BEFORE: `\u201c{t.quote}\u201d`
   AFTER:  `“{t.quote}”`

5. Footer tagline:
   BEFORE: `— for people who\u2019d rather do the work than chase the money.`
   AFTER:  `— for people who’d rather do the work than chase the money.`

No other changes to the file. This note is repo documentation of the patch;
the replacements below in page.tsx are the actual fix.