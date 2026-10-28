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
| 7 The dog you’d like | What size of dog would you like? | **Small** |
| 8 Dog experience | Have you owned a dog before? | **No, first dog** |
| | Any dogs already at home? | *(leave empty)* |
| 9 Life at home | What is your home usually like? | **Calm** |
| | Does anyone at home have pet allergies? | **Yes** |
| 10 Other pets | Do you have any other pets? | **No** |

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
| 7 The dog you’d like | What size of dog would you like? | **Medium** |
| 8 Dog experience | Have you owned a dog before? | **Yes** |
| 9 Life at home | What is your home usually like? | **A mix** |
| | Does anyone at home have pet allergies? | **No** |
| 10 Other pets | Do you have any other pets? | **Yes** → What kind? **Cat** |

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
| 7 The dog you’d like | What size of dog would you like? | **Large** |
| 8 Dog experience | Have you owned a dog before? | **Yes** |
| 9 Life at home | What is your home usually like? | **A mix** |
| | Does anyone at home have pet allergies? | **No** |
| 10 Other pets | Do you have any other pets? | **No** |

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

## In-app test run (30 Oct 2026, paid API, fresh account)

All data deleted, then a new account ("Mia") went through all 10 onboarding steps by
hand; the Nguyens' and Sam and Priya's answers were then set and checked against
`scenarios.json` (all match). Each photo uploaded as a new scan (3 slices, edge to edge).

| Household | "Dogs who'd love it here" (real AI) | Picked | Result |
|---|---|---|---|
| Small (Mia) | Great match: French Bulldog, Coton de Tulear, American Hairless Terrier; Could work: Chinese Crested +4 | French Bulldog | NEARLY READY, DO FIRST: balcony railing gaps. 6 items: peace lily, power strip and cords, lit candle, balcony railing, chair near railing, sliding door |
| Medium (Nguyens) | Great match: Field Spaniel, English Cocker Spaniel, Barbet, Standard Schnauzer +2; every plan mentions the cat | Field Spaniel | NEARLY READY, 7 things to sort: sliding door, pothos, small toys, kitchen bin, cat bed; keep out of the kitchen with a pressure-fit gate |
| Large (Sam and Priya) | Great match: Labrador, Bracco Italiano, Bernese Mountain Dog, Boxer +1, all large | Labrador | READY FOR A LABRADOR RETRIEVER, 5 things: bi-fold door, plants, mug on table, slippery floor; existing dog bed spotted |

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
