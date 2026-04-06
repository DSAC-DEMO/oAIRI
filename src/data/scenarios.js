// Readiness Assessment Framework — used by ResultsPage for the level breakdown display
export const READINESS_LEVELS = {
  EXPERT: {
    label: 'Expert Ready',
    range: [85, 100],
    description: 'Demonstrates exceptional decision-making and readiness across all scenarios',
    color: 'emerald'
  },
  ADVANCED: {
    label: 'Advanced Ready',
    range: [70, 84],
    description: 'Shows strong readiness with consistent good judgment',
    color: 'green'
  },
  INTERMEDIATE: {
    label: 'Moderately Ready',
    range: [55, 69],
    description: 'Displays adequate readiness with room for development',
    color: 'yellow'
  },
  DEVELOPING: {
    label: 'Developing',
    range: [40, 54],
    description: 'Shows basic readiness but needs significant improvement',
    color: 'orange'
  },
  NOVICE: {
    label: 'Novice',
    range: [0, 39],
    description: 'Limited readiness; requires substantial training and support',
    color: 'red'
  }
};
