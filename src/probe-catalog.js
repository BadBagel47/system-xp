// The probes shown in System Xp. Used both by the page and by the
// data script (scripts/fetch-probes.mjs) that downloads trajectories
// from NASA/JPL Horizons.
//
// afterData: what to draw after the last data point:
//   'extrapolate' – keep moving in a straight line (spacecraft coasting out of the solar system)
//   'hide'        – the trajectory is unknown or the mission ended; hide the probe
// active: true if new data should be fetched on every update run.

export const PROBES = [
  {
    id: 'voyager-1',
    name: 'Voyager 1',
    horizons: '-31',
    color: 0x7fe0ff,
    launch: '1977-09-05',
    active: true,
    afterData: 'extrapolate',
    agency: 'NASA',
    summary:
      'Flew past Jupiter (1979) and Saturn (1980), then headed out of the solar system. It crossed into interstellar space in 2012 and is the most distant human-made object.',
  },
  {
    id: 'voyager-2',
    name: 'Voyager 2',
    horizons: '-32',
    color: 0x4fa8ff,
    launch: '1977-08-20',
    active: true,
    afterData: 'extrapolate',
    agency: 'NASA',
    summary:
      'The only spacecraft to have visited all four giant planets: Jupiter (1979), Saturn (1981), Uranus (1986) and Neptune (1989). It reached interstellar space in 2018.',
  },
  {
    id: 'pioneer-10',
    name: 'Pioneer 10',
    horizons: '-23',
    color: 0xffb36b,
    launch: '1972-03-03',
    active: false,
    afterData: 'extrapolate',
    agency: 'NASA',
    summary:
      'The first spacecraft to cross the asteroid belt and to fly past Jupiter (1973). Its last signal reached Earth in 2003; it keeps coasting out of the solar system.',
  },
  {
    id: 'pioneer-11',
    name: 'Pioneer 11',
    horizons: '-24',
    color: 0xff8a5c,
    launch: '1973-04-06',
    active: false,
    afterData: 'extrapolate',
    agency: 'NASA',
    summary:
      'Flew past Jupiter (1974) and became the first spacecraft to visit Saturn (1979). Contact was lost in 1995; it keeps coasting out of the solar system.',
  },
  {
    id: 'new-horizons',
    name: 'New Horizons',
    horizons: '-98',
    color: 0xb48cff,
    launch: '2006-01-19',
    active: true,
    afterData: 'extrapolate',
    agency: 'NASA',
    summary:
      'Used Jupiter for a gravity assist (2007), made the first flyby of Pluto (2015) and then flew past the Kuiper Belt object Arrokoth (2019).',
  },
  {
    id: 'cassini',
    name: 'Cassini',
    horizons: '-82',
    color: 0xffd84f,
    launch: '1997-10-15',
    end: '2017-09-15T10:31:00Z',
    active: false,
    afterData: 'hide',
    agency: 'NASA / ESA / ASI',
    summary:
      'Orbited Saturn from 2004 to 2017 and dropped the Huygens probe onto Titan. The mission ended with a deliberate dive into Saturn on 15 September 2017.',
  },
  {
    id: 'galileo',
    name: 'Galileo',
    horizons: '-77',
    color: 0x9cff8a,
    launch: '1989-10-18',
    end: '2003-09-21T18:57:00Z',
    active: false,
    afterData: 'hide',
    agency: 'NASA',
    summary:
      'Reached Jupiter in 1995 after flybys of Venus, Earth and two asteroids, and orbited the planet for eight years. It was sent into Jupiter on 21 September 2003.',
  },
  {
    id: 'juno',
    name: 'Juno',
    horizons: '-61',
    color: 0xff6fb5,
    launch: '2011-08-05',
    active: true,
    afterData: 'hide',
    agency: 'NASA',
    summary:
      'Swung past Earth in 2013 and entered a polar orbit around Jupiter in July 2016 to study the planet’s interior, atmosphere and magnetic field.',
  },
  {
    id: 'parker-solar-probe',
    name: 'Parker Solar Probe',
    short: 'Parker',
    horizons: '-96',
    color: 0xff5a4f,
    launch: '2018-08-12',
    active: true,
    afterData: 'hide',
    agency: 'NASA',
    summary:
      'Uses repeated Venus flybys to dive ever closer to the Sun. On 24 December 2024 it passed about 6.1 million km from the Sun’s surface – the closest any spacecraft has been.',
  },
  {
    id: 'juice',
    name: 'JUICE',
    horizons: '-28',
    color: 0x5fffd0,
    launch: '2023-04-14',
    active: true,
    afterData: 'hide',
    agency: 'ESA',
    summary:
      'ESA’s Jupiter Icy Moons Explorer. It gathers speed with flybys of the Moon, Earth and Venus and is planned to reach Jupiter in July 2031 to study Ganymede, Callisto and Europa.',
  },
  {
    id: 'europa-clipper',
    name: 'Europa Clipper',
    horizons: '-159',
    color: 0xc6ff5a,
    launch: '2024-10-14',
    active: true,
    afterData: 'hide',
    agency: 'NASA',
    summary:
      'Heading for Jupiter, using flybys of Mars (2025) and Earth (2026). It is planned to arrive in 2030 and fly past Jupiter’s moon Europa dozens of times.',
  },
];

export const PROBE_BY_ID = Object.fromEntries(PROBES.map((p) => [p.id, p]));
