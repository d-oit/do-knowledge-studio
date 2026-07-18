/**
 * TRIZ: 40 Inventive Principles.
 *
 * Based on the classic Altshuller TRIZ methodology.
 */

export interface TrizPrinciple {
  id: number
  name: string
  description: string
  examples: string[]
}

export const TRIZ_PRINCIPLES: TrizPrinciple[] = [
  { id: 1, name: 'Segmentation', description: 'Divide an object into independent parts; make an object sectional; increase the degree of fragmentation.', examples: ['Modular furniture', 'Composite materials', 'Fracturing rock with perforated charges'] },
  { id: 2, name: 'Taking out / Extraction', description: 'Separate the interfering part or property from an object, or single out the only necessary part.', examples: ['Noise-canceling headphones extract ambient noise', 'Oxygen masks on airplanes', 'Extracting vitamins from food'] },
  { id: 3, name: 'Local quality', description: 'Make each part of an object function in conditions most suitable for its operation.', examples: ['Gradient lenses', 'Soccer cleats with different studs', 'Multi-tip screwdriver'] },
  { id: 4, name: 'Asymmetry', description: 'Change the shape of an object from symmetrical to asymmetrical.', examples: ['Asymmetric tire tread for wet/dry grip', 'Curved computer mouse', 'Offset hinges on a door'] },
  { id: 5, name: 'Consolidation / Merging', description: 'Bring together identical or related tasks; perform simultaneous operations on nearby objects.', examples: ['Swiss army knife', 'Multi-function printer', 'Conference call'] },
  { id: 6, name: 'Universality', description: 'Make an object perform multiple functions; eliminate the need for other objects.', examples: ['Smartphone replacing camera, GPS, music player', 'Sofa bed', 'Multi-tool'] },
  { id: 7, name: 'Nested doll', description: 'Place one object inside another; place each object inside the next.', examples: ['Nesting dolls', 'Telescoping antenna', 'Collapsible camping gear'] },
  { id: 8, name: 'Anti-weight', description: 'Compensate for the weight of an object by combining it with something that provides lift.', examples: ['Helium balloons for lifting cables', 'Airplane wings', 'Pontoons on a boat'] },
  { id: 9, name: 'Preliminary anti-action', description: 'Precompensate for a harmful action before it occurs.', examples: ['Earthquake-resistant buildings', 'Pre-stressed concrete', 'Backup power systems'] },
  { id: 10, name: 'Preliminary action', description: 'Perform the required action in advance, fully or partially.', examples: ['Self-adhesive bandages', 'Pre-mixed concrete', 'Pre-programmed thermostat'] },
  { id: 11, name: 'Beforehand cushioning', description: 'Compensate for the relatively low reliability of an object by preparing emergency measures.', examples: ['Emergency parachute', 'Safety net', 'Surge protector'] },
  { id: 12, name: 'Equipotentiality', description: 'If an object must be raised or lowered, change the object to eliminate the need.', examples: ['Lazy Susan turntable', 'Loading dock at truck-bed height', 'Chute instead of lifting'] },
  { id: 13, name: 'The other way round', description: 'Instead of the direct action dictated by the problem, implement an opposite action.', examples: ['Cooling instead of heating to shrink parts', 'Moving the part instead of the tool', 'Parking garage where cars stack downward'] },
  { id: 14, name: 'Spheroidality / Curvature', description: 'Replace linear parts with curved; replace cubical shapes with spherical; use rollers, balls, spirals.', examples: ['Ballpoint pen replacing fountain pen nib', 'Spherical gears', 'Curved monitor screens'] },
  { id: 15, name: 'Dynamics', description: 'Allow characteristics of an object to change to be optimal; make rigid objects movable.', examples: ['Adjustable wrench', 'Flexible phone screens', 'Variable-speed drill'] },
  { id: 16, name: 'Partial or excessive action', description: 'If 100% of an object is hard to achieve, make it more or less.', examples: ['Rounded paint brush tips', 'Overfilling a cushion then trimming', 'Weather stripping that compresses'] },
  { id: 17, name: 'Another dimension', description: 'Move an object in 2D to 3D; use multi-layered arrangements.', examples: ['Gyroscope', 'Multi-story parking', '3D chip architecture'] },
  { id: 18, name: 'Mechanical vibration', description: 'Cause an object to oscillate; use ultrasound; resonance.', examples: ['Ultrasonic cleaner', 'Vibrating pile driver', 'Tuning fork'] },
  { id: 19, name: 'Periodic action', description: 'Replace a continuous action with a periodic one.', examples: ['Strobe light replacing continuous light', 'Pulsed laser', 'Intermittent windshield wipers'] },
  { id: 20, name: 'Useful action continuously', description: 'Make all parts of an object work continuously at full capacity.', examples: ['Continuous production line', '24/7 power plant', 'Blood circulation'] },
  { id: 21, name: 'Rushing through', description: 'Perform harmful or hazardous actions at very high speed.', examples: ['Laser cutting', 'Flash pasteurization', 'Rapid prototyping'] },
  { id: 22, name: 'Blessing in disguise', description: 'Use harmful factors to achieve a positive effect.', examples: ['Using waste heat for power generation', 'Rough surface for better grip', 'Red mud from aluminum production used in cement'] },
  { id: 23, name: 'Feedback', description: 'Introduce feedback to improve a process.', examples: ['Thermostat', 'Cruise control', 'Microphone feedback cancellation'] },
  { id: 24, name: 'Mediator', description: 'Use an intermediary object to transfer or perform an action.', examples: ['Oven mitts', 'Surrogate models for testing', 'Relay in electronics'] },
  { id: 25, name: 'Self-service', description: 'Make an object serve itself; use free energy.', examples: ['Solar-powered calculator', 'Self-cleaning oven', 'Self-sharpening lawn mower blade'] },
  { id: 26, name: 'Copying', description: 'Use a simpler or cheaper copy instead of an expensive fragile object.', examples: ['Virtual reality for training', 'Satellite images instead of ground surveys', 'Photocopies'] },
  { id: 27, name: 'Cheap short-lived object', description: 'Replace an expensive object with multiple inexpensive ones.', examples: ['Disposable camera', 'Paper plates for parties', 'Single-use medical instruments'] },
  { id: 28, name: 'Mechanics substitution', description: 'Replace a mechanical system with a sensory, optical, acoustic, or electric one.', examples: ['Touchscreen replacing buttons', 'LIDAR replacing radar', 'Electronic compass'] },
  { id: 29, name: 'Pneumatics and hydraulics', description: 'Use gas and liquid parts instead of solid parts.', examples: ['Hydraulic press', 'Air cushions for moving heavy objects', 'Pneumatic door closers'] },
  { id: 30, name: 'Flexible membranes / Thin films', description: 'Use flexible membranes or thin films instead of rigid structures.', examples: ['Shrink wrap', 'Touchscreen membrane switches', 'Rain poncho'] },
  { id: 31, name: 'Porous materials', description: 'Make an object porous; use porous inserts or coatings.', examples: ['Filter', 'Pumice stone', 'Porous concrete for drainage'] },
  { id: 32, name: 'Color changes', description: 'Change the color of an object or its environment.', examples: ['Thermochromic paint', 'Photochromic glasses', 'Traffic light colors'] },
  { id: 33, name: 'Homogeneity', description: 'Make objects interacting with a given object of the same material.', examples: ['Diamond tip on drill bit', 'Same-material weld', 'Matching paint for repairs'] },
  { id: 34, name: 'Discarding and recovering', description: 'Discard or dissolve parts that have completed their function; restore worn parts.', examples: ['Self-healing concrete', 'Biodegradable packaging', 'Self-sharpening pencil'] },
  { id: 35, name: 'Parameter changes', description: 'Change the physical state, concentration, consistency, or flexibility of an object.', examples: ['Freeze-drying food', 'Liquid to gas in refrigeration', 'Thermosetting plastics'] },
  { id: 36, name: 'Phase transitions', description: 'Use phenomena occurring during phase transitions.', examples: ['Heat pipes using evaporation/condensation', 'Shape-memory alloys', 'Liquid crystal displays'] },
  { id: 37, name: 'Thermal expansion', description: 'Use thermal expansion or contraction of materials.', examples: ['Thermostat bimetallic strip', 'Shrink-fitting bearings', 'Heat-shrink tubing'] },
  { id: 38, name: 'Strong oxidants', description: 'Replace air with enriched air; use ionized air.', examples: ['Oxyacetylene welding', 'Oxygen-enriched hospital air', 'Ozone water treatment'] },
  { id: 39, name: 'Inert atmosphere', description: 'Replace a normal environment with an inert one.', examples: ['Nitrogen-flushed chip bags', 'Inert gas welding shield', 'Vacuum packaging'] },
  { id: 40, name: 'Composite materials', description: 'Change from uniform to composite materials.', examples: ['Carbon fiber reinforced plastic', 'Fiberglass', 'Ceramic matrix composites'] },
]
