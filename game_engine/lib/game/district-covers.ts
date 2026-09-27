import type { StaticImageData } from "next/image";

// The first covers: painted art, kept for reference and for anything that
// wants the old look.
import puraniSadakArt from "../../public/covers/purani-sadak.png";
import marinaNagarArt from "../../public/covers/marina-nagar.png";
import majesticCrossArt from "../../public/covers/majestic-cross.png";
import parkGullyArt from "../../public/covers/park-gully.png";
import charminarLaneArt from "../../public/covers/charminar-lane.jpg";
import fortKochiArt from "../../public/covers/fort-kochi.jpg";
import dadarChowkArt from "../../public/covers/dadar-chowk.jpg";
import manekChowkArt from "../../public/covers/manek-chowk.jpg";
import hallBazaarArt from "../../public/covers/hall-bazaar.jpg";
import lingarajLaneArt from "../../public/covers/lingaraj-lane.jpg";

// Stills from the game itself (public/covers/game): each city's hero view,
// and four more of its streets and landmarks.
import puraniSadak from "../../public/covers/game/purani-sadak.jpg";
import puraniSadak1 from "../../public/covers/game/purani-sadak-1.jpg";
import puraniSadak2 from "../../public/covers/game/purani-sadak-2.jpg";
import puraniSadak3 from "../../public/covers/game/purani-sadak-3.jpg";
import puraniSadak4 from "../../public/covers/game/purani-sadak-4.jpg";
import marinaNagar from "../../public/covers/game/marina-nagar.jpg";
import marinaNagar1 from "../../public/covers/game/marina-nagar-1.jpg";
import marinaNagar2 from "../../public/covers/game/marina-nagar-2.jpg";
import marinaNagar3 from "../../public/covers/game/marina-nagar-3.jpg";
import marinaNagar4 from "../../public/covers/game/marina-nagar-4.jpg";
import majesticCross from "../../public/covers/game/majestic-cross.jpg";
import majesticCross1 from "../../public/covers/game/majestic-cross-1.jpg";
import majesticCross2 from "../../public/covers/game/majestic-cross-2.jpg";
import majesticCross3 from "../../public/covers/game/majestic-cross-3.jpg";
import majesticCross4 from "../../public/covers/game/majestic-cross-4.jpg";
import parkGully from "../../public/covers/game/park-gully.jpg";
import parkGully1 from "../../public/covers/game/park-gully-1.jpg";
import parkGully2 from "../../public/covers/game/park-gully-2.jpg";
import parkGully3 from "../../public/covers/game/park-gully-3.jpg";
import parkGully4 from "../../public/covers/game/park-gully-4.jpg";
import charminarLane from "../../public/covers/game/charminar-lane.jpg";
import charminarLane1 from "../../public/covers/game/charminar-lane-1.jpg";
import charminarLane2 from "../../public/covers/game/charminar-lane-2.jpg";
import charminarLane3 from "../../public/covers/game/charminar-lane-3.jpg";
import charminarLane4 from "../../public/covers/game/charminar-lane-4.jpg";
import fortKochi from "../../public/covers/game/fort-kochi.jpg";
import fortKochi1 from "../../public/covers/game/fort-kochi-1.jpg";
import fortKochi2 from "../../public/covers/game/fort-kochi-2.jpg";
import fortKochi3 from "../../public/covers/game/fort-kochi-3.jpg";
import fortKochi4 from "../../public/covers/game/fort-kochi-4.jpg";
import dadarChowk from "../../public/covers/game/dadar-chowk.jpg";
import dadarChowk1 from "../../public/covers/game/dadar-chowk-1.jpg";
import dadarChowk2 from "../../public/covers/game/dadar-chowk-2.jpg";
import dadarChowk3 from "../../public/covers/game/dadar-chowk-3.jpg";
import dadarChowk4 from "../../public/covers/game/dadar-chowk-4.jpg";
import manekChowk from "../../public/covers/game/manek-chowk.jpg";
import manekChowk1 from "../../public/covers/game/manek-chowk-1.jpg";
import manekChowk2 from "../../public/covers/game/manek-chowk-2.jpg";
import manekChowk3 from "../../public/covers/game/manek-chowk-3.jpg";
import manekChowk4 from "../../public/covers/game/manek-chowk-4.jpg";
import hallBazaar from "../../public/covers/game/hall-bazaar.jpg";
import hallBazaar1 from "../../public/covers/game/hall-bazaar-1.jpg";
import hallBazaar2 from "../../public/covers/game/hall-bazaar-2.jpg";
import hallBazaar3 from "../../public/covers/game/hall-bazaar-3.jpg";
import hallBazaar4 from "../../public/covers/game/hall-bazaar-4.jpg";
import lingarajLane from "../../public/covers/game/lingaraj-lane.jpg";
import lingarajLane1 from "../../public/covers/game/lingaraj-lane-1.jpg";
import lingarajLane2 from "../../public/covers/game/lingaraj-lane-2.jpg";
import lingarajLane3 from "../../public/covers/game/lingaraj-lane-3.jpg";
import lingarajLane4 from "../../public/covers/game/lingaraj-lane-4.jpg";

/** The painted covers the district picker first used. */
export const DISTRICT_ART_COVERS: Record<string, StaticImageData> = {
  "purani-sadak": puraniSadakArt,
  "marina-nagar": marinaNagarArt,
  "majestic-cross": majesticCrossArt,
  "park-gully": parkGullyArt,
  "charminar-lane": charminarLaneArt,
  "fort-kochi": fortKochiArt,
  "dadar-chowk": dadarChowkArt,
  "manek-chowk": manekChowkArt,
  "hall-bazaar": hallBazaarArt,
  "lingaraj-lane": lingarajLaneArt,
};

/** Each city's cover: its best view, captured in the game. Bundled so every card loads in dev and prod. */
export const DISTRICT_COVER_IMAGES: Record<string, StaticImageData> = {
  "purani-sadak": puraniSadak,
  "marina-nagar": marinaNagar,
  "majestic-cross": majesticCross,
  "park-gully": parkGully,
  "charminar-lane": charminarLane,
  "fort-kochi": fortKochi,
  "dadar-chowk": dadarChowk,
  "manek-chowk": manekChowk,
  "hall-bazaar": hallBazaar,
  "lingaraj-lane": lingarajLane,
};

export type CityView = { image: StaticImageData; caption: string };

/** What the cover shows, and four more views of the city, each captioned. */
export const DISTRICT_GALLERY: Record<string, { cover: string; views: CityView[] }> = {
  "purani-sadak": {
    cover: "Jama Masjid",
    views: [
      { image: puraniSadak1, caption: "Gurdwara Sis Ganj Sahib" },
      { image: puraniSadak2, caption: "Sunehri Masjid" },
      { image: puraniSadak3, caption: "Gauri Shankar Mandir" },
      { image: puraniSadak4, caption: "Chandni Chowk" },
    ],
  },
  "marina-nagar": {
    cover: "Parthasarathy Koil",
    views: [
      { image: marinaNagar1, caption: "The temple car" },
      { image: marinaNagar2, caption: "Kannagi on the Marina" },
      { image: marinaNagar3, caption: "Thiruvalluvar" },
      { image: marinaNagar4, caption: "Triplicane's temple streets" },
    ],
  },
  "majestic-cross": {
    cover: "Sapna Theatre",
    views: [
      { image: majesticCross1, caption: "Santosh Theatre" },
      { image: majesticCross2, caption: "Kempegowda Bus Station" },
      { image: majesticCross3, caption: "Majestic's streets" },
      { image: majesticCross4, caption: "Annammadevi temple" },
    ],
  },
  "park-gully": {
    cover: "St Thomas' Church",
    views: [
      { image: parkGully1, caption: "Park Street" },
      { image: parkGully2, caption: "The Asiatic Society" },
      { image: parkGully3, caption: "Madina Masjid" },
      { image: parkGully4, caption: "Chowringhee Mansions" },
    ],
  },
  "charminar-lane": {
    cover: "The Charminar",
    views: [
      { image: charminarLane1, caption: "Mecca Masjid" },
      { image: charminarLane2, caption: "Gulzar Houz" },
      { image: charminarLane3, caption: "Machli Kaman" },
      { image: charminarLane4, caption: "Bhagyalaxmi Temple" },
    ],
  },
  "fort-kochi": {
    cover: "The Chinese fishing nets",
    views: [
      { image: fortKochi1, caption: "St Francis Church" },
      { image: fortKochi2, caption: "Santa Cruz Basilica" },
      { image: fortKochi3, caption: "Vasco da Gama Square" },
      { image: fortKochi4, caption: "Little Flower Church" },
    ],
  },
  "dadar-chowk": {
    cover: "Plaza Cinema",
    views: [
      { image: dadarChowk1, caption: "Kabutar Khana" },
      { image: dadarChowk2, caption: "Swaminarayan Mandir" },
      { image: dadarChowk3, caption: "Pir Baghdadi Masjid" },
      { image: dadarChowk4, caption: "Hanuman Mandir" },
    ],
  },
  "manek-chowk": {
    cover: "Jama Masjid",
    views: [
      { image: manekChowk1, caption: "Rani's Hajira" },
      { image: manekChowk2, caption: "Tomb of Ahmad Shah" },
      { image: manekChowk3, caption: "Teen Darwaza" },
      { image: manekChowk4, caption: "The old city" },
    ],
  },
  "hall-bazaar": {
    cover: "Harmandir Sahib",
    views: [
      { image: hallBazaar1, caption: "Akal Takht" },
      { image: hallBazaar2, caption: "Jallianwala Bagh" },
      { image: hallBazaar3, caption: "Gurdwara Santokhsar" },
      { image: hallBazaar4, caption: "The parikrama" },
    ],
  },
  "lingaraj-lane": {
    cover: "Lingaraj Temple",
    views: [
      { image: lingarajLane1, caption: "Jalamandira, Bindu Sagar" },
      { image: lingarajLane2, caption: "Chitrakarini Temple" },
      { image: lingarajLane3, caption: "Mohini Temple" },
      { image: lingarajLane4, caption: "Yameswar Temple" },
    ],
  },
};

/** One line for each city: what it's like to be there. */
export const DISTRICT_LINES: Record<string, string> = {
  "purani-sadak": "Chandni Chowk at full tilt: cycle rickshaws under the Jama Masjid, the gold domes of Sis Ganj Sahib, a bargain in every lane.",
  "marina-nagar": "Triplicane's temple streets run down to the Marina: Parthasarathy's gopuram, the temple car, statues along the sand and the sea behind.",
  "majestic-cross": "Majestic never stops: buses in and out of Kempegowda, single-screen cinemas lit up down the road, autos at every corner.",
  "park-gully": "Park Street's mansion blocks and colonnades, St Thomas' spire, the Asiatic Society, and yellow taxis working the evening crowd.",
  "charminar-lane": "The Charminar at the heart of it, Mecca Masjid's great courtyard, the fountain at Gulzar Houz and the old kamans across the lanes.",
  "fort-kochi": "Chinese fishing nets along the shore, the seafood stalls in Vasco da Gama Square, and churches four centuries old.",
  "dadar-chowk": "Dadar's crossroads: pigeons at the Kabutar Khana, the Plaza's marquee, a marble mandir and a masjid a few streets apart.",
  "manek-chowk": "Ahmedabad's old walled city: the Jama Masjid, the sultans' tombs, and Teen Darwaza's arches over the market.",
  "hall-bazaar": "The Golden Temple on its sarovar, the Akal Takht across the parikrama, Jallianwala Bagh a short walk through the bazaar.",
  "lingaraj-lane": "Bhubaneswar's temple town: the Lingaraj rising over its compound, a deul down every lane, the Jalamandira out on Bindu Sagar.",
};
