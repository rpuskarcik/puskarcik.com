// Puskarcik family data for family-tree.js.
// One entry per person. "parents" lists parent ids; "spouses" lists marriages.
// Marriage dates: type a year or date into "wed_date" (e.g. "1932" or "12 Jun 1932").
// It appears when visitors hover over the dashed line. Fill "end_date" only if the marriage ended
// (shown as "1932 – 1960"). Leave both as "" if unknown; nothing is shown then.
// To add someone: copy an entry, give it a new unique id, and reference that id from relatives.
var people = [
  {
    "id": "ludwig",
    "name": "Ludwig Puskarczyk",
    "gender": "M",
    "birth_date": "25 Aug 1886",
    "death_date": "30 May 1955",
    "birth_place": "Poland",
    "bio": "Patriarch of the Puskarczyk family; emigrated from Poland.",
    "parents": [],
    "spouses": [
      {
        "id": "aniela",
        "wed_date": "",
        "end_date": ""
      }
    ]
  },
  {
    "id": "aniela",
    "name": "Aniela Malek",
    "gender": "F",
    "birth_date": "1 Feb 1891",
    "death_date": "5 Feb 1941",
    "birth_place": "Poland",
    "bio": "Matriarch of the Puskarczyk family.",
    "parents": [],
    "spouses": []
  },
  {
    "id": "chester",
    "name": "Chester Puskarcik",
    "gender": "M",
    "birth_date": "28 Nov 1908",
    "death_date": "1 Apr 1974",
    "parents": [
      "ludwig",
      "aniela"
    ],
    "spouses": [
      {
        "id": "vera",
        "wed_date": "",
        "end_date": ""
      }
    ],
    "link": "chester"
  },
  {
    "id": "vera",
    "name": "Vera",
    "gender": "F",
    "parents": [],
    "spouses": []
  },
  {
    "id": "helen",
    "name": "Helen Puskarcik",
    "gender": "F",
    "birth_date": "24 Apr 1910",
    "death_date": "3 Dec 1988",
    "parents": [
      "ludwig",
      "aniela"
    ],
    "spouses": [
      {
        "id": "michael-cvengros",
        "wed_date": "",
        "end_date": ""
      }
    ]
  },
  {
    "id": "michael-cvengros",
    "name": "Michael Cvengros",
    "gender": "M",
    "birth_date": "14 Jul 1912",
    "death_date": "5 Jun 1958",
    "parents": [],
    "spouses": []
  },
  {
    "id": "lottie",
    "name": "Lottie Puskarcik",
    "gender": "F",
    "birth_date": "22 Feb 1912",
    "death_date": "12 Sep 1958",
    "parents": [
      "ludwig",
      "aniela"
    ],
    "spouses": [
      {
        "id": "philip-houser",
        "wed_date": "",
        "end_date": ""
      }
    ]
  },
  {
    "id": "philip-houser",
    "name": "Philip Houser",
    "gender": "M",
    "parents": [],
    "spouses": []
  },
  {
    "id": "jean",
    "name": "Jean Puskarcik",
    "gender": "F",
    "birth_date": "12 Aug 1914",
    "death_date": "d m 1990",
    "parents": [
      "ludwig",
      "aniela"
    ],
    "spouses": [
      {
        "id": "joseph-gromada",
        "wed_date": "",
        "end_date": ""
      }
    ]
  },
  {
    "id": "joseph-gromada",
    "name": "Joseph Gromada",
    "gender": "M",
    "birth_date": "21 Nov 1911",
    "death_date": "18 Oct 1992",
    "parents": [],
    "spouses": []
  },
  {
    "id": "stephanie",
    "name": "Stephanie Puskarcik",
    "gender": "F",
    "birth_date": "5 Jun 1915",
    "death_date": "14 Dec 1944",
    "parents": [
      "ludwig",
      "aniela"
    ],
    "spouses": []
  },
  {
    "id": "carl",
    "name": "Carl John Puskarcik",
    "gender": "M",
    "birth_date": "20 Mar 1919",
    "death_date": "1 Jan 2016",
    "parents": [
      "ludwig",
      "aniela"
    ],
    "spouses": [
      {
        "id": "helen-dubaj",
        "wed_date": "",
        "end_date": ""
      }
    ],
    "link": "carl"
  },
  {
    "id": "helen-dubaj",
    "name": "Helen Dubaj",
    "gender": "F",
    "birth_date": "16 Apr 1927",
    "death_date": "12 Dec 2016",
    "parents": [],
    "spouses": []
  },
  {
    "id": "stasia",
    "name": "Stasia (Tunny) Puskarcik",
    "gender": "F",
    "birth_date": "7 Jun 1925",
    "death_date": "8 Apr 2012",
    "parents": [
      "ludwig",
      "aniela"
    ],
    "spouses": [
      {
        "id": "george-sertich",
        "wed_date": "",
        "end_date": ""
      }
    ]
  },
  {
    "id": "george-sertich",
    "name": "George Sertich",
    "gender": "M",
    "birth_date": "9 Jun 1926",
    "death_date": "30 Jun 2003",
    "parents": [],
    "spouses": []
  },
  {
    "id": "thaddeus",
    "name": "Thaddeus Robert Puskarcik",
    "gender": "M",
    "birth_date": "27 May 1927",
    "death_date": "29 Jun 2014",
    "parents": [
      "ludwig",
      "aniela"
    ],
    "spouses": [
      {
        "id": "tillie-balogh",
        "wed_date": "",
        "end_date": ""
      }
    ],
    "link": "thaddeus"
  },
  {
    "id": "tillie-balogh",
    "name": "Tillie Theresa Marie Balogh",
    "gender": "F",
    "birth_date": "4 Dec 1927",
    "death_date": "3 Oct 2020",
    "parents": [],
    "spouses": []
  }
];
