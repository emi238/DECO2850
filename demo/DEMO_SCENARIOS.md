# PawSpace demo scenarios

Three households for demos and testing, aimed at a **small**, a **medium** and a
**large** dog. Each has the exact questionnaire answers to tap (in the order the
onboarding steps ask them), the breeds the real AI suggested, and a prompt for a
matching room photo.

Run them again any time (uses `.env.local`; one Gemini request per scenario):

```bash
node scripts/demo-scenarios.mjs
```

`node scripts/demo-scenarios.mjs small` runs one scenario; add `--shortlist` to see
the 30 breeds the rules hand to the AI (no AI calls). Full results:
`demo/results/<id>.json`. The AI's picks vary a little between runs.

---

## 1. Small dog: Mia, first dog in a small rented city apartment

| Onboarding step | Question | Tap |
|---|---|---|
| 1 Your home | Dwelling Type | **Apartment** |
| | Is this a rental? | **Yes** |
| 2 Your neighbours | How close are your nearest neighbours? | **Attached walls** |
| 3 Outdoor space | Outdoor Access | **Balcony** |
| | Will the dog get to use it? | **Rarely** |
| 4 Who lives with you | Any children living at home? | **No** |
| 5 A typical day | How long would the dog be home alone? | **4 to 8 hours** |
| | Will someone check in on the dog? | **No** |
| 6 Your routine | How active are you day to day? | **Mostly relaxed** |
| | Time for walks and play each day? | **Under 30 min** |
| 7 Dog experience | Have you owned a dog before? | **No, first dog** |
| | Any dogs already at home? | *(leave empty)* |
| 8 Life at home | What is your home usually like? | **Calm** |
| | Does anyone at home have pet allergies? | **Yes** |
| 9 Other pets | Do you have any other pets? | **No** |

**AI suggestions (run 25 Oct 2026, Gemini, 281-breed catalogue):** French Bulldog
(good), Coton de Tulear (good), Cirneco dell'Etna, Pug, Bulldog, English Toy
Spaniel, Japanese Chin, Pekingese (could work). Seven of eight are small; every
watch-out mentions grooming for the allergy.

**Room photo prompt** (save as `demo/images/small.jpg`):
> A realistic smartphone photo, taken standing in the doorway at eye height, of a
> small rented city apartment living room: a two-seater sofa against a shared wall,
> a TV on a low unit with loose cables and a power board on the floor, a potted
> peace lily on the floor beside the sofa, polished floorboards with a small rug, a
> glass sliding door to a narrow balcony with metal railings with wide gaps, a low
> coffee table with a candle. Daytime, lights on, lived-in, no people, no text.

---

## 2. Medium dog: the Nguyens, family townhouse with a cat and a courtyard

| Onboarding step | Question | Tap |
|---|---|---|
| 1 Your home | Dwelling Type | **House** |
| | Is this a rental? | **No** |
| 2 Your neighbours | How close are your nearest neighbours? | **Close, but a separate building** |
| 3 Outdoor space | Outdoor Access | **Private Yard** |
| | Will the dog get to use it? | **Sometimes** |
| 4 Who lives with you | Any children living at home? | **Yes, 5 or older** |
| 5 A typical day | How long would the dog be home alone? | **Under 4 hours** |
| 6 Your routine | How active are you day to day? | **Fairly active** |
| | Time for walks and play each day? | **30 to 60 min** |
| 7 Dog experience | Have you owned a dog before? | **Yes** |
| 8 Life at home | What is your home usually like? | **A mix** |
| | Does anyone at home have pet allergies? | **No** |
| 9 Other pets | Do you have any other pets? | **Yes** → What kind? **Cat** |

**AI suggestions (25 Oct 2026):** Labrador Retriever, Cavalier King Charles
Spaniel, Coton de Tulear, Barbet, French Bulldog, Bohemian Shepherd (good),
Clumber Spaniel, Bulldog (could work). A mix of sizes, with three medium breeds
(Barbet, Bohemian Shepherd, Bulldog); every watch-out is about introducing the cat.

**Room photo prompt** (save as `demo/images/medium.jpg`):
> A realistic smartphone photo of an open-plan family living and kitchen area in a
> townhouse: an L-shaped sofa, children's toys and a few shoes on a large rug, low
> open shelves with small potted plants and a glass vase, a kitchen bench with a
> bin beside it, a cat bed by the window, a glass sliding door open to a small paved
> courtyard with a low fence. Afternoon light, tidy but lived-in, no people, no text.

---

## 3. Large dog: Sam and Priya, active couple with a big suburban house and yard

| Onboarding step | Question | Tap |
|---|---|---|
| 1 Your home | Dwelling Type | **House** |
| | Is this a rental? | **No** |
| 2 Your neighbours | How close are your nearest neighbours? | **Not close by** |
| 3 Outdoor space | Outdoor Access | **Private Yard** |
| | Will the dog get to use it? | **Most days** |
| 4 Who lives with you | Any children living at home? | **No** |
| 5 A typical day | How long would the dog be home alone? | **Under 4 hours** |
| 6 Your routine | How active are you day to day? | **Very active** |
| | Time for walks and play each day? | **Over an hour** |
| 7 Dog experience | Have you owned a dog before? | **Yes** |
| 8 Life at home | What is your home usually like? | **A mix** |
| | Does anyone at home have pet allergies? | **No** |
| 9 Other pets | Do you have any other pets? | **No** |

**AI suggestions (25 Oct 2026):** Border Collie, Labrador Retriever, Australian
Shepherd, Australian Cattle Dog, Barbet, Australian Terrier (good), Afghan Hound,
French Bulldog (could work). The theme is active, athletic dogs; only one is
classed large (Labrador), because the catalogue sizes by weight and nothing in the
answers asks for a big dog (see findings).

**Room photo prompt** (save as `demo/images/large.jpg`):
> A realistic smartphone photo of a spacious, bright suburban living room with lots
> of clear floor space: a large sofa, a wide rug, a quiet corner big enough for a
> large dog bed, hard timber floors, wide glass doors open to a big fenced grassy
> backyard. Daylight, tidy, no people, no text.

---

## Room photos

The API key's free tier allows **no** image generation (Google returns "limit: 0"
for its image models), so these photos aren't generated yet. Two options:

- **Free:** paste each prompt into the Gemini app (gemini.google.com), download the
  image, and save it as `demo/images/small.jpg`, `medium.jpg`, `large.jpg`. Re-running
  the script then also runs the real room check for each household's top breed.
- **Paid:** turn on billing for the key's Google project, and the script can generate
  them directly (a small charge per image; check Google’s current pricing).

To demo in the app, put the photos on the phone and use **Upload Photos**.

## Findings from these runs

1. **The AI fixes a gap in the rules for apartments.** Before a room is analysed,
   the rules shortlist for Mia's rented apartment ranks giant breeds first
   (Broholmer, Neapolitan Mastiff, Pyrenean Mastiff). Dwelling type and rental
   don't affect the rules' size fit; only a room photo does. Gemini ignored them,
   but without AI (or when Google is busy) the fallback list would lead with them.
2. **Allergies aren't in the rules.** No Poodle, Bichon, Maltese or Schnauzer made
   the 30-breed shortlist for the allergy household, so the AI could only pick from
   shedders and mention grooming.
3. **No way to ask for a size.** The questionnaire has no size preference, so a
   household that could suit a large dog gets mostly medium, athletic breeds.
