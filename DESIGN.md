# Design decisions

The decisions behind Rainwater Harvesting Studio, and my reasons for them.
[`ARCHITECTURE.md`](ARCHITECTURE.md) describes how the code is organised, and
the [method notes](docs/method-notes.html) describe the method clause by
clause, every figure the code leaves unsourced, and what it does not model.
This file records why the tool is the way it is. Written in October 2026, at
version 1.2.0.

— Karam Al-Obaidi

## Why it exists

My students needed to size rainwater harvesting for buildings they were
designing. What they had did not connect the calculation to the design:

- **Online calculators** are 2D forms: type a roof area, get a number. There
  is no geometry, so the roof's shape cannot be explored.
- **Spreadsheets** meant doing the sums by hand.

## Why it runs in the browser

- **Nothing to install.** No licence and no admin rights, on lab PCs or on
  students' own laptops.
- **Any device, and embeddable.** It runs on any machine and sits inside my
  website.

## Method

### A parametric 3D roof

The calculation starts from a roof the student shapes in 3D.

- **Design teaching.** Students design roofs, so the tool starts from a roof
  they can shape.
- **Roof form choices.** Gable, hip, butterfly, vault, green roofs and the
  rest can be compared on the same footprint.

### BS EN 16941-1:2024, and a sourced rainfall library

- **The current standard.** It is the standard used in UK practice, with the
  UK National Annex.
- **Traceable.** Every formula and coefficient is traced to a clause, and
  every city's rainfall to a station.
- **The same as practice.** Students meet the same method in professional
  sizing.

### A daily water balance by default

Since 1.1.0 the store is stepped daily unless the student chooses monthly.

- **A monthly step misleads.** It draws a whole month's demand at once, so a
  small tank reads far below what it achieves.
- **Closer to practice.** Daily balances are what continuous-simulation tools
  use.

### The Explain and report sheets

- **Show the working.** The Explain sheet walks through the calculation with
  the student's own numbers.
- **Name the deliverable.** It makes students state the store capacity and
  what limits it, rather than quoting the biggest number.
- **For crits and submissions.** The A3 report is a sheet students can pin up
  or submit.

## Teaching

I use the tool in undergraduate and postgraduate teaching.

**The exercises are mine**: the three in the method notes and the eight under
"Teaching with it" in the README. The three in the method notes are:

1. The tank that stops paying for itself.
2. Pitch changes the roof and not the harvest.
3. Nearly the same rainfall, arriving at the wrong time.

## What it leaves out

- **Water quality.** No treatment design, contamination or potable use.
- **Pumps and pipes.** No pump sizing, pipework or energy.
- **Cost and payback.** No capital cost, savings or payback period.
- **Climate change.** Rainfall is a 1991–2020 baseline, with no future
  rainfall.

## How a release is checked

Before I teach with a release:

- **I use the live site myself**, as a student would.
- **I work through the exercises** and check that they still show what they
  should.
- **I check a yield or a store size against my own hand calculation.**

## Licensing and archiving

The code is MIT and the teaching material is CC BY 4.0:

- **The code is free to reuse.** Anyone can adapt or embed it.
- **The material is reusable with credit.** Other educators can use the notes
  and exercises in their own courses, crediting the source.
- **The cube mark is reserved from both**, so a modified copy cannot pass
  itself off as mine.
- **Open licensing is expected** of this kind of work by my university or
  funders.

Every version is archived on Zenodo with its own DOI:

- **Reproducible figures.** A reported number can be traced to the exact build
  that produced it.
- **A citable research output.** The software counts as an output in its own
  right.
- **A permanent archive.** Each version survives even if my website changes.
- **Credit when reused.** Anyone who uses it has a proper way to cite it.

## How this was developed

I designed the application. I defined the problem and the scope: what the tool
is for, who it is for and what it leaves out. I chose the methods and the
sources it relies on, and set the exercises. I tested it in use, found and
reported the bugs, judged whether each fix worked, and decided what was
released and when.

The code was written with an AI coding assistant, working to my specification
and direction. It wrote most of the code, drafted the documentation, which I
reviewed, diagnosed bugs and proposed fixes, which I then tested, and wrote and
ran the automated tests and release checks. I retain full intellectual
responsibility for the design, the methods and the results, including any
errors.

## Next

- **Future rainfall**: climate-change scenarios for the rainfall library.
- **Cost and payback**: tank cost, mains savings and a payback period.
- **Site context**: several buildings and ground surfaces draining to shared
  stores.
- **A real daily series**: the balance run on real daily rainfall rather than
  a series built from monthly normals.
