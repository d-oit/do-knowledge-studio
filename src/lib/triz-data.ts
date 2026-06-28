/**
 * TRIZ (Theory of Inventive Problem Solving) Data Model.
 *
 * Contains the 39 Engineering Parameters, 40 Inventive Principles,
 * and the Contradiction Matrix for resolving technical contradictions.
 */

export const ENGINEERING_PARAMETERS = [
  'Weight of Moving Object',
  'Weight of Non-Moving Object',
  'Length of Moving Object',
  'Length of Non-Moving Object',
  'Area of Moving Object',
  'Area of Non-Moving Object',
  'Volume of Moving Object',
  'Volume of Non-Moving Object',
  'Speed',
  'Force',
  'Tension/Pressure',
  'Shape',
  'Stability of Object',
  'Strength',
  'Duration of Moving Object\'s Action',
  'Duration of Non-Moving Object\'s Action',
  'Temperature',
  'Illumination Intensity',
  'Energy Spent by Moving Object',
  'Energy Spent by Non-Moving Object',
  'Power',
  'Loss of Substance',
  'Loss of Information',
  'Loss of Time',
  'Loss of Quantity of Motion',
  'Loss of Information',
  'Object Affected by External Factors',
  'Object\'s Harmful Side Effects',
  'Harmful Side Effects',
  'External Factors Affecting Object',
  'Ease of Manufacturing',
  'Ease of Use',
  'Ease of Repair',
  'Adaptability/Versatility',
  'Complication of Device',
  'Complexity of Control',
  'Harmful Effects on Environment',
  'Level of Automation',
  'Productivity',
] as const;

export const INVENTIVE_PRINCIPLES: Array<{
  number: number;
  name: string;
  description: string;
  examples: string[];
}> = [
  {
    number: 1,
    name: 'Segmentation',
    description: 'Divide an object into independent parts',
    examples: ['Modular furniture', 'Multi-tool knives', 'Modular software components'],
  },
  {
    number: 2,
    name: 'Taking Out',
    description: 'Extract the relevant part from an object',
    examples: ['Noise-cancelling headphones', 'Extracting caffeine from coffee'],
  },
  {
    number: 3,
    name: 'Local Quality',
    description: 'Make each part of an object work in conditions most suitable for it',
    examples: ['Pencil eraser tip', 'Multi-density mattress', 'Zoned climate control'],
  },
  {
    number: 4,
    name: 'Asymmetry',
    description: 'Change from symmetrical to asymmetrical',
    examples: ['Asymmetric screw threads', 'Right-hand drive cars', 'Offset handles'],
  },
  {
    number: 5,
    name: 'Merging',
    description: 'Combine similar or identical objects',
    examples: ['Multi-function devices', 'Stackable containers', 'Combined washer-dryer'],
  },
  {
    number: 6,
    name: 'Universality',
    description: 'Make an object perform multiple functions',
    examples: ['Swiss army knife', 'Smartphone', 'Multi-purpose cleaner'],
  },
  {
    number: 7,
    name: 'Nesting',
    description: 'Place one object inside another',
    examples: ['Telescoping antennas', 'Nesting dolls', 'Collapsible furniture'],
  },
  {
    number: 8,
    name: 'Anti-Weight',
    description: 'Compensate for weight by merging with forces from the environment',
    examples: ['Helium balloons', 'Hydraulic lifts', 'Parachutes'],
  },
  {
    number: 9,
    name: 'Preliminary Anti-Action',
    description: 'Pre-arrange to counteract harmful effects',
    examples: ['Pre-shrunk fabric', 'Pre-stressed concrete', 'Backup batteries'],
  },
  {
    number: 10,
    name: 'Preliminary Action',
    description: 'Perform required changes before they are needed',
    examples: ['Pre-heating oven', 'Pre-medication', 'Pre-charged batteries'],
  },
  {
    number: 11,
    name: 'Beforehand Compensating',
    description: 'Compensate for limited reliability in advance',
    examples: ['Safety margins', 'Redundant systems', 'Insurance'],
  },
  {
    number: 12,
    name: 'Equipotentiality',
    description: 'Change conditions so object doesn\'t need to be raised/lowered',
    examples: ['Conveyor belts', 'Level access ramps', 'Elevator pits'],
  },
  {
    number: 13,
    name: 'Reverse It',
    description: 'Instead of the standard action, do the opposite',
    examples: ['Reversible jackets', 'Two-way zippers', 'Undo in software'],
  },
  {
    number: 14,
    name: 'Spheroidality',
    description: 'Replace linear parts with curved, balls, or spirals',
    examples: ['Roller bearings', 'Curved roads', 'Spherical joints'],
  },
  {
    number: 15,
    name: 'Dynamics',
    description: 'Make a process or object dynamic to optimize performance',
    examples: ['Adjustable spoilers', 'Dynamic pricing', 'Adaptive cruise control'],
  },
  {
    number: 16,
    name: 'Partial or Excessive Action',
    description: 'If 100% is difficult, achieve slightly more or less',
    examples: ['Overfill then sand', 'Pre-load bolts', 'Approximate pi for calculation'],
  },
  {
    number: 17,
    name: 'Another Dimension',
    description: 'Move to a new dimension or use multi-layer arrangements',
    examples: ['Double-decker buses', '3D chips', 'Layered clothing'],
  },
  {
    number: 18,
    name: 'Mechanical Vibration',
    description: 'Use oscillation or vibration',
    examples: ['Ultrasonic cleaners', 'Vibrating conveyors', 'Sonar'],
  },
  {
    number: 19,
    name: 'Periodic Action',
    description: 'Replace continuous action with periodic or pulsating action',
    examples: ['Pulse jet engines', 'Strobe lights', 'Intermittent wipers'],
  },
  {
    number: 20,
    name: 'Continuity of Useful Action',
    description: 'Make all parts work continuously',
    examples: ['Continuous casting', '24/7 operations', 'Flow production'],
  },
  {
    number: 21,
    name: 'Skipping',
    description: 'Perform parts of a process that are inharmonious or dangerous',
    examples: ['Remote surgery', 'Autonomous vehicles', 'Drone delivery'],
  },
  {
    number: 22,
    name: 'Blessing in Disguise',
    description: 'Use harmful factors to achieve positive effects',
    examples: ['Recycling waste heat', 'Using corrosion for etching', 'Composting'],
  },
  {
    number: 23,
    name: 'Feedback',
    description: 'Introduce feedback to improve a process',
    examples: ['Thermostats', 'Touchscreens', 'Quality control loops'],
  },
  {
    number: 24,
    name: 'Mediator',
    description: 'Use an intermediary to transmit or connect',
    examples: ['USB cables', 'Wireless adapters', 'Universal translators'],
  },
  {
    number: 25,
    name: 'Self-Service',
    description: 'Make the object serve itself',
    examples: ['Self-cleaning ovens', 'Self-checkout', 'Self-healing materials'],
  },
  {
    number: 26,
    name: 'Copying',
    description: 'Use a copy instead of an expensive original',
    examples: ['Virtual reality', 'Simulations', 'Proxy servers'],
  },
  {
    number: 27,
    name: 'Cheap Short-Living Objects',
    description: 'Replace expensive object with multiple cheap ones',
    examples: ['Disposable razors', 'Single-use cameras', 'Paper plates'],
  },
  {
    number: 28,
    name: 'Mechanics Substitution',
    description: 'Replace mechanical system with sensory (optical, acoustic, taste)',
    examples: ['Touchscreens', 'Voice commands', 'Fingerprint scanners'],
  },
  {
    number: 29,
    name: 'Pneumatics and Hydraulics',
    description: 'Use gas/liquid instead of solid parts',
    examples: ['Hydraulic brakes', 'Pneumatic tools', 'Air cushions'],
  },
  {
    number: 30,
    name: 'Flexible Film or Thin Films',
    description: 'Replace rigid parts with flexible membranes',
    examples: ['Solar sails', 'Flexible displays', 'Inflatable structures'],
  },
  {
    number: 31,
    name: 'Porous Materials',
    description: 'Make an object porous or add porous elements',
    examples: ['Filters', 'Sponges', 'Porous concrete'],
  },
  {
    number: 32,
    name: 'Color Changes',
    description: 'Change the color of an object or its environment',
    examples: ['Thermochromic paint', 'Mood rings', 'E-ink displays'],
  },
  {
    number: 33,
    name: 'Homogeneity',
    description: 'Make parts interacting with the main object from the same material',
    examples: ['Diamond cutting diamond', 'Same-material welding', 'Dental fillings'],
  },
  {
    number: 34,
    name: 'Discarding and Recovering',
    description: 'Discard parts after use, or recover discarded parts',
    examples: ['Biodegradable packaging', 'Recyclable materials', 'Seed pods'],
  },
  {
    number: 35,
    name: 'Parameter Changes',
    description: 'Change physical state, density, or degree of flexibility',
    examples: ['Phase change materials', 'Non-Newtonian fluids', 'Memory foam'],
  },
  {
    number: 36,
    name: 'Phase Transitions',
    description: 'Use phenomena occurring during phase transitions',
    examples: ['Shape-memory alloys', 'Heat pipes', 'Evaporative cooling'],
  },
  {
    number: 37,
    name: 'Thermal Expansion',
    description: 'Use thermal expansion or contraction of materials',
    examples: ['Bimetallic strips', 'Thermostats', 'Heat-shrink tubing'],
  },
  {
    number: 38,
    name: 'Strong Oxidants',
    description: 'Use strong oxidants instead of ordinary air',
    examples: ['Oxy-acetylene welding', 'Oxygen concentrators', 'Ozone treatment'],
  },
  {
    number: 39,
    name: 'Inert Atmosphere',
    description: 'Replace ordinary environment with inert one',
    examples: ['Nitrogen-flushed packaging', 'Argon welding', 'Vacuum sealing'],
  },
  {
    number: 40,
    name: 'Composite Materials',
    description: 'Replace homogeneous materials with composite ones',
    examples: ['Carbon fiber', 'Fiberglass', 'Kevlar'],
  },
];

/**
 * Simplified contradiction matrix.
 * Maps (improving parameter index, worsening parameter index) → top 3 principle numbers.
 * Uses a sparse representation for efficiency.
 */
const MATRIX_DATA: Record<string, number[]> = {
  '1-2': [1, 8, 15],
  '1-3': [17, 29, 34],
  '1-4': [17, 29, 34],
  '1-12': [13, 14, 15],
  '2-1': [1, 8, 15],
  '2-3': [17, 29, 34],
  '3-1': [17, 29, 34],
  '3-4': [1, 14, 15],
  '9-10': [13, 28, 15],
  '9-14': [8, 3, 26],
  '10-14': [3, 35, 40],
  '11-12': [13, 14, 10],
  '13-14': [2, 35, 40],
  '14-15': [1, 15, 29],
  '17-18': [19, 32, 35],
  '21-22': [21, 35, 2],
  '28-30': [22, 35, 13],
  '35-36': [15, 10, 37],
  '4-32': [35, 28, 31],
};

export function getContradictionPrinciples(
  improvingIdx: number,
  worseningIdx: number,
): number[] {
  const key = `${improvingIdx + 1}-${worseningIdx + 1}`;
  return MATRIX_DATA[key] ?? [1, 10, 35, 28]; // Default principles
}

export function getPrincipleByNumber(num: number) {
  return INVENTIVE_PRINCIPLES.find(p => p.number === num);
}
