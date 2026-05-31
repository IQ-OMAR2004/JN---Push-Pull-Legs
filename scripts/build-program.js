#!/usr/bin/env node
/*
 * Builds program.json for the PPL Tracker app, parsed from
 * Jeff Nippard's Push/Pull/Legs Hypertrophy Program PDF.
 *
 * Run: `node scripts/build-program.js`
 * Output: program.json (placed at the project root)
 *
 * Data shape:
 *   program → blocks[] → weeks[] → days[] → exercises[]
 *
 * Exercise rows in the PDF use either a %1RM (with "%") or a single
 * RPE number. We preserve which one was prescribed in `load.type`.
 */
const fs = require('fs');
const path = require('path');

const P = v => ({ type: 'percent1RM', value: v });
const R = v => ({ type: 'rpe', value: v });

// =============================================================
// TEMPLATES — fixed within a block; weekly tables (below) only
// vary sets / reps / load.
// =============================================================
const templates = { 1: [], 2: [] };

templates[1].push({ name: 'Legs #1', exercises: [
  { name: 'Back Squat',                     rest: '3-4min', supersetGroup: null, notes: 'Sit back and down, 15° toe flare, drive your knees out laterally' },
  { name: 'Deadlift',                       rest: '3-4min', supersetGroup: null, notes: 'Brace your lats, chest tall, hips high, pull the slack out of the bar prior to moving it off the ground' },
  { name: 'Barbell Hip Thrust',             rest: '2-3min', supersetGroup: null, notes: 'Tuck your chin and rib cage down, only move your hips. Use a pad' },
  { name: 'Dumbbell Walking Lunge',         rest: '1-2min', supersetGroup: null, notes: 'Take medium strides, minimize the amount you push off your rear leg' },
  { name: 'A1: Leg Extension',              rest: '0min',   supersetGroup: 'A',  notes: 'Focus on squeezing your quads to move the weight' },
  { name: 'A2: Seated Leg Curl',            rest: '1-2min', supersetGroup: 'A',  notes: 'Focus on squeezing your hamstrings to move the weight' },
  { name: 'Standing Calf Raise',            rest: '1-2min', supersetGroup: null, notes: "Press all the way up to your toes, stretch your calves at the bottom, don't bounce" },
]});

templates[1].push({ name: 'Push #1', exercises: [
  { name: 'Barbell Bench Press',            rest: '2-3min', supersetGroup: null, notes: 'Tuck elbows at a 45° angle, squeeze your shoulder blades and stay firm on the bench' },
  { name: 'Dumbbell Seated Shoulder Press', rest: '2-3min', supersetGroup: null, notes: 'Bring the dumbbell all the way down, keep your torso upright' },
  { name: 'Weighted Dip',                   rest: '1-2min', supersetGroup: null, notes: 'Tuck your elbows at a 45° angle, lean your torso forward 15°, keep your scapulae retracted' },
  { name: 'Low-to-High Cable Flye',         rest: '1-2min', supersetGroup: null, notes: 'Start externally rotated with your elbows down and out, pull your elbows (not hands) up and in while slightly internally rotating your shoulder' },
  { name: 'Dumbbell Isolateral Skull Crusher', rest: '1-2min', supersetGroup: null, notes: 'Use 1 dumbbell in each hand. Keep your elbows in a fixed position inline with the top of your head, press the dumbbell over your head (not in front of your face)' },
  { name: 'Dumbbell Lateral Raise',         rest: '1-2min', supersetGroup: null, notes: 'Tilt the dumbbell such that your pinky comes up first' },
  { name: 'Ab Wheel Rollout',               rest: '1-2min', supersetGroup: null, notes: "Keep your pelvis posteriorly tilted (squeeze your glutes), cut the ROM short if you can't maintain this position" },
]});

templates[1].push({ name: 'Pull #1', exercises: [
  { name: '1 Arm Lat Pull-in',              rest: '1-2min', supersetGroup: null, notes: 'Light sets, drive elbow down and in toward side, laterally flex into the direction of pull' },
  { name: 'Pull-up',                        rest: '2-3min', supersetGroup: null, notes: 'Pull your elbows down and in, minimize swinging' },
  { name: 'Pendlay Row',                    rest: '2-3min', supersetGroup: null, notes: 'Initiate the movement with scapular retraction, pull to your lower chest, keep your torso motionless' },
  { name: 'Machine High Row',               rest: '1-2min', supersetGroup: null, notes: 'Focus on squeezing your lats' },
  { name: 'Seated Face Pull',               rest: '1-2min', supersetGroup: null, notes: 'Pull your elbows up and out, retract your scapulae' },
  { name: 'A1: Reverse Grip EZ Bar Curl',   rest: '0min',   supersetGroup: 'A',  notes: 'Arch the bar "out", not "up". Focus on squeezing your forearms' },
  { name: 'A2: Supinated EZ Bar Curl',      rest: '1-2min', supersetGroup: 'A',  notes: 'Arch the bar "out", not "up". Focus on squeezing your biceps' },
  { name: 'Dumbbell Preacher Curl',         rest: '1-2min', supersetGroup: null, notes: 'Focus on squeezing your biceps to move the weight' },
]});

templates[1].push({ name: 'Legs #2', exercises: [
  { name: 'Deadlift',                       rest: '3-4min', supersetGroup: null, notes: 'Brace your lats, chest tall, hips high, pull the slack out of the bar prior to moving it off the ground' },
  { name: 'Front Squat',                    rest: '2-3min', supersetGroup: null, notes: 'Sit down, 15° toe flare, drive your knees out laterally' },
  { name: 'Cable Pull Through',             rest: '1-2min', supersetGroup: null, notes: 'Focus on anteriorly tilting your pelvis during the eccentric, posteriorly during the concentric' },
  { name: 'Single-Leg Leg Press',           rest: '1-2min', supersetGroup: null, notes: 'High foot placement' },
  { name: 'Single-Leg Leg Extension',       rest: '1-2min', supersetGroup: null, notes: 'Start with your weaker leg, focus on squeezing your quads to move the weight' },
  { name: 'Swiss Ball Single-Leg Leg Curl', rest: '1-2min', supersetGroup: null, notes: 'Start with your weaker leg, prevent your hips from touching the ground' },
  { name: 'Standing Calf Raise',            rest: '1-2min', supersetGroup: null, notes: "Press all the way up to your toes, stretch your calves at the bottom, don't bounce" },
]});

templates[1].push({ name: 'Push #2', exercises: [
  { name: 'Close-Grip Bench Press',         rest: '2-3min', supersetGroup: null, notes: 'Shoulder width grip, elbows down at your sides' },
  { name: 'Military Press',                 rest: '2-3min', supersetGroup: null, notes: 'Squeeze your glutes to keep your torso upright, clear your head out of the way, press up and slightly back' },
  { name: 'Dumbbell Incline Press',         rest: '1-2min', supersetGroup: null, notes: 'Keep your scapulae retracted and depressed' },
  { name: 'Pec Deck',                       rest: '1-2min', supersetGroup: null, notes: 'Focus on bringing your inner elbows together - not your hands' },
  { name: 'Cable Lateral Raise',            rest: '1-2min', supersetGroup: null, notes: 'Focus on squeezing your lateral delt to move the weight' },
  { name: 'Cable Triceps Kickback',         rest: '1-2min', supersetGroup: null, notes: 'Stand upright, keep your elbows behind your torso' },
  { name: 'Bicycle Crunch',                 rest: '1-2min', supersetGroup: null, notes: 'Opposite knee to elbow, focus on flexing your spine' },
]});

templates[1].push({ name: 'Pull #2', exercises: [
  { name: 'Neutral-Grip Pulldown',                  rest: '2-3min', supersetGroup: null, notes: 'Pull your elbows down against your sides' },
  { name: 'A1: Cable Seated Elbows Out Row',        rest: '0min',   supersetGroup: 'A',  notes: 'Focus on scapular retraction, pull with your elbows up and out' },
  { name: 'A2: Cable Seated Row',                   rest: '2-3min', supersetGroup: 'A',  notes: 'Focus on scapular retraction, pull with your elbows down and in' },
  { name: 'Kneeling Straight-Arm Cable Pull-Over',  rest: '1-2min', supersetGroup: null, notes: 'Lean your torso at a 45° angle, focus on pulling the weight straight down, not "in"' },
  { name: 'Snatch Grip Barbell Shrug',              rest: '1-2min', supersetGroup: null, notes: 'Use a 1.5x shoulder width grip, control the weight and "shrug up to your ears"' },
  { name: 'Cable Reverse Flye',                     rest: '0min',   supersetGroup: null, notes: 'Focus on sweeping the weight out laterally' },
  { name: 'Single-Arm Cable Curl',                  rest: '1-2min', supersetGroup: null, notes: 'Stand upright, keep your elbow behind your torso' },
  { name: 'Hammer Curl',                            rest: '1-2min', supersetGroup: null, notes: 'Focus on squeezing your biceps to move the weight' },
]});

// --- Block 2 templates ---
templates[2].push({ name: 'Legs #1', exercises: [
  { name: 'Deadlift',                            rest: '3-4min', supersetGroup: null, notes: 'Brace your lats, chest tall, hips high, pull the slack out of the bar prior to moving it off the ground' },
  { name: 'Tempo Back Squat',                    rest: '3-4min', supersetGroup: null, notes: 'Full 2-second lowering phase. Sit back and down, 15° toe flare, drive your knees out laterally' },
  { name: 'Round-Back Dumbbell 45° Hyperextension', rest: '1-2min', supersetGroup: null, notes: 'Upper back rounded, drive your hips into the pad like a hip thrust' },
  { name: 'Smith Machine Reverse Lunge',         rest: '1-2min', supersetGroup: null, notes: 'Sit back, start with your weaker leg' },
  { name: 'Enhanced-Eccentric Leg Extension',    rest: '1-2min', supersetGroup: null, notes: 'Have a training partner push down on the pad during the eccentric' },
  { name: 'Enhanced-Eccentric Lying Leg Curl',   rest: '1-2min', supersetGroup: null, notes: 'Have a training partner push down on the pad during the eccentric' },
  { name: 'Lateral Band Walk',                   rest: '1-2min', supersetGroup: null, notes: 'Or machine hip abduction, focus on driving your knees out' },
  { name: 'Tempo Standing Calf Raise',           rest: '1-2min', supersetGroup: null, notes: "2-second lowering phase. Press all the way up to your toes, stretch your calves at the bottom, don't bounce" },
]});

templates[2].push({ name: 'Push #1', exercises: [
  { name: 'Barbell Bench Press',           rest: '2-3min', supersetGroup: null, notes: 'Tuck elbows at a 45° angle, keep your scapulae retracted and depressed' },
  { name: 'Arnold Press',                  rest: '1-2min', supersetGroup: null, notes: 'Start your shoulders internally rotated, gradually externally rotate them as you press up' },
  { name: 'Close-Grip Smith Machine Press', rest: '1-2min', supersetGroup: null, notes: 'Shoulder width grip, elbows down at your sides' },
  { name: 'Low-to-High Cable Flye',        rest: '1-2min', supersetGroup: null, notes: 'Start externally rotated with your elbows down and out, pull your elbows (not hands) up and in while slightly internally rotating your shoulder' },
  { name: 'Barbell Floor Skull Crusher',   rest: '1-2min', supersetGroup: null, notes: 'Protract your shoulders, keep your elbows inline with your head, only move at the elbow joint' },
  { name: 'Egyptian Lateral Raise',        rest: '1-2min', supersetGroup: null, notes: 'Lean away from the cable, focus on squeezing your delts' },
  { name: 'Rope Overhead Triceps Extension', rest: '1-2min', supersetGroup: null, notes: 'Focus on stretching your triceps at the bottom of the movement' },
  { name: 'Hanging Leg Raise',             rest: '1-2min', supersetGroup: null, notes: 'Focus on flexing your spine' },
]});

templates[2].push({ name: 'Pull #1', exercises: [
  { name: '1 Arm Lat Pull-in',              rest: '1-2min', supersetGroup: null, notes: 'Light sets, drive elbow down and in toward side, laterally flex into the direction of pull' },
  { name: 'Pull-up',                        rest: '2-3min', supersetGroup: null, notes: 'Add weight or use assistance as needed' },
  { name: 'Dumbbell One-Arm Row',           rest: '1-2min', supersetGroup: null, notes: 'Brace with your non-working arm, pull your arms back at your sides' },
  { name: 'Chest-Supported T-Bar Row w/ Band', rest: '1-2min', supersetGroup: null, notes: 'See Science Applied YT series for video on this' },
  { name: 'Low-to-High Reverse Flye',       rest: '1-2min', supersetGroup: null, notes: 'This is a cross between a shrug, a row, and a reverse cable fly - scapular retraction & upward rotation, abduction of the humerus' },
  { name: 'Rope Upright Row',               rest: '1-2min', supersetGroup: null, notes: 'Focus on squeezing the upper traps at the top and initiating the movement "out"' },
  { name: 'Dumbbell Supinated Curl',        rest: '1-2min', supersetGroup: null, notes: 'Think about driving your pinky to your lateral delt' },
  { name: 'Spider Curl',                    rest: '1-2min', supersetGroup: null, notes: 'Brace your chest against an incline bench, curl with your elbows slightly in front of you' },
]});

templates[2].push({ name: 'Legs #2', exercises: [
  { name: 'Back Squat',                  rest: '3-4min', supersetGroup: null, notes: 'Sit back and down, 15° toe flare, drive your knees out laterally' },
  { name: 'Romanian Deadlift',           rest: '2-3min', supersetGroup: null, notes: 'Focus on keeping your spine neutral, anterior pelvic tilt during the eccentric' },
  { name: 'Pause Barbell Hip Thrust',    rest: '2-3min', supersetGroup: null, notes: '3-second pause. Tuck your chin and rib cage down, only move your hips. Use a pad' },
  { name: 'Slow Eccentric Goblet Squat', rest: '1-2min', supersetGroup: null, notes: '3-second lowering phase. Sit down, knees out, torso upright' },
  { name: 'Seated Leg Curl',             rest: '1-2min', supersetGroup: null, notes: 'Focus on squeezing your hamstrings to move the weight' },
  { name: 'Cable Rope Pullthrough',      rest: '1-2min', supersetGroup: null, notes: 'Focus on squeezing your glutes to move the weight' },
  { name: 'Standing Calf Raise',         rest: '1-2min', supersetGroup: null, notes: "Press all the way up to your toes, stretch your calves at the bottom, don't bounce" },
]});

templates[2].push({ name: 'Push #2', exercises: [
  { name: 'Barbell Bench Press',                rest: '2-3min', supersetGroup: null, notes: 'Tuck elbows at a 45° angle, keep your scapulae retracted and depressed' },
  { name: 'Military Press / Push Press Complex', rest: '2-3min', supersetGroup: null, notes: 'First 4 reps military press, last 4 reps push press (use leg drive)' },
  { name: 'Slow Eccentric Dip',                 rest: '1-2min', supersetGroup: null, notes: '3-second lowering phase. Tuck elbows at a 45° angle, lean your torso forward 15°' },
  { name: 'Triceps V-Bar Pressdown',            rest: '1-2min', supersetGroup: null, notes: 'Focus on squeezing your triceps to move the weight' },
  { name: 'Machine Lateral Raise',              rest: '1-2min', supersetGroup: null, notes: 'Focus on squeezing your lateral delt to move the weight' },
  { name: 'Plank',                              rest: '1-2min', supersetGroup: null, notes: 'Keep your pelvis posteriorly tilted' },
]});

templates[2].push({ name: 'Pull #2', exercises: [
  { name: 'Single-Arm Pulldown',                    rest: '2-3min', supersetGroup: null, notes: 'Start with your weaker side, stretch your lat at the top, pull down and in' },
  { name: 'Seal Row',                               rest: '2-3min', supersetGroup: null, notes: 'You can do this with dumbbells or a barbell, squeeze your glutes to keep your torso stable' },
  { name: 'Kneeling Straight-Arm Cable Pull-Over',  rest: '1-2min', supersetGroup: null, notes: 'Lean your torso at a 45° angle, focus on pulling the weight straight down, not "in"' },
  { name: 'Reverse Pec Deck',                       rest: '1-2min', supersetGroup: null, notes: 'Sweep your arms out laterally, keep your scapulae protracted' },
  { name: 'A1: Dumbbell Pronated Curl',             rest: '0min',   supersetGroup: 'A',  notes: 'Arch the dumbbell "out", not "up". Focus on squeezing your forearms' },
  { name: 'A2: Dumbbell Hammer Curl',               rest: '0min',   supersetGroup: 'A',  notes: 'Arch the dumbbell "out", not "up". Focus on squeezing your forearms' },
  { name: 'A3: Dumbbell Supinated Curl',            rest: '1-2min', supersetGroup: 'A',  notes: 'Arch the dumbbell "out", not "up". Focus on squeezing your biceps' },
]});

// =============================================================
// WEEKLY DATA — per-week per-day (sets, reps, load) rows.
// Position matches the templates above. tsv = "Total Set Volume"
// as printed in the PDF (we trust the printed value verbatim).
// =============================================================
const weekly = { 1: [], 2: [] };

// --- BLOCK 1 ---
// Week 1
weekly[1].push([
  { tsv: 20, rows: [[4,'5',P(70)], [2,'8',P(65)], [3,'10-12',R(6)], [2,'20 each leg',R(7)], [3,'15',R(7)], [3,'15',R(7)], [3,'10',R(7)]] },
  { tsv: 21, rows: [[3,'4',P(75)], [3,'8-10',R(7)], [3,'6-10',R(7)], [3,'12-15',R(8)], [3,'12',R(8)], [3,'15',R(8)], [3,'6',R(7)]] },
  { tsv: 22, rows: [[2,'15-20',R(5)], [4,'6-8',R(7)], [3,'8-10',R(7)], [3,'10-12',R(8)], [3,'20',R(8)], [3,'20',R(9)], [3,'15',R(9)], [3,'12',R(7)]] },
  { tsv: 22, rows: [[4,'4',P(72.5)], [3,'6-8',P(60)], [3,'20',R(8)], [3,'10-12',R(7)], [3,'15',R(7)], [3,'12',R(7)], [3,'15',R(7)]] },
  { tsv: 21, rows: [[3,'6',P(70)], [3,'5',P(80)], [3,'10-12',R(7)], [3,'15',R(7)], [3,'8',R(8)], [3,'20',R(8)], [3,'12',R(7)]] },
  { tsv: 24, rows: [[3,'10-12',R(8)], [3,'10',R(8)], [3,'10',R(8)], [3,'15',R(7)], [3,'15',R(8)], [3,'20',R(8)], [3,'12',R(7)], [3,'8',R(7)]] },
]);
// Week 2
weekly[1].push([
  { tsv: 20, rows: [[4,'5',P(75)], [2,'8',P(65)], [3,'10-12',R(8)], [2,'20 each leg',R(9)], [3,'15',R(9)], [3,'15',R(9)], [3,'10',R(7)]] },
  { tsv: 21, rows: [[3,'4',P(80)], [3,'8-10',R(8)], [3,'6-10',R(7)], [3,'12-15',R(9)], [3,'12',R(9)], [3,'15',R(8)], [3,'6',R(8)]] },
  { tsv: 22, rows: [[2,'15-20',R(5)], [4,'6-8',R(8)], [3,'8-10',R(8)], [3,'10-12',R(9)], [3,'20',R(9)], [3,'20',R(10)], [3,'15',R(10)], [3,'12',R(8)]] },
  { tsv: 22, rows: [[4,'4',P(77.5)], [3,'6-8',P(60)], [3,'20',R(9)], [3,'10-12',R(8)], [3,'15',R(8)], [3,'12',R(8)], [3,'15',R(8)]] },
  { tsv: 21, rows: [[3,'6',P(72.5)], [3,'5',P(80)], [3,'10-12',R(8)], [3,'15',R(8)], [3,'8',R(9)], [3,'20',R(9)], [3,'12',R(8)]] },
  { tsv: 24, rows: [[3,'10-12',R(8)], [3,'10',R(8)], [3,'10',R(8)], [3,'15',R(7)], [3,'15',R(8)], [3,'20',R(8)], [3,'12',R(9)], [3,'8',R(9)]] },
]);
// Week 3
weekly[1].push([
  { tsv: 20, rows: [[4,'5',P(77.5)], [2,'8',P(70)], [3,'10-12',R(8)], [2,'20 each leg',R(9)], [3,'15',R(9)], [3,'15',R(9)], [3,'10',R(7)]] },
  { tsv: 21, rows: [[3,'4',P(82.5)], [3,'8-10',R(8)], [3,'6-10',R(7)], [3,'12-15',R(9)], [3,'12',R(9)], [3,'15',R(8)], [3,'6',R(8)]] },
  { tsv: 22, rows: [[2,'15-20',R(5)], [4,'6-8',R(8)], [3,'8-10',R(8)], [3,'10-12',R(9)], [3,'20',R(9)], [3,'20',R(10)], [3,'15',R(10)], [3,'12',R(8)]] },
  { tsv: 22, rows: [[4,'4',P(80)], [3,'6-8',P(65)], [3,'20',R(9)], [3,'10-12',R(8)], [3,'15',R(8)], [3,'12',R(8)], [3,'15',R(8)]] },
  { tsv: 21, rows: [[3,'6',P(75)], [3,'5',P(82.5)], [3,'10-12',R(8)], [3,'15',R(8)], [3,'8',R(9)], [3,'20',R(9)], [3,'12',R(8)]] },
  { tsv: 24, rows: [[3,'10-12',R(8)], [3,'10',R(8)], [3,'10',R(8)], [3,'15',R(7)], [3,'15',R(8)], [3,'20',R(8)], [3,'12',R(7)], [3,'8',R(7)]] },
]);
// Week 4
weekly[1].push([
  { tsv: 20, rows: [[4,'5',P(80)], [2,'8',P(70)], [3,'10-12',R(8)], [2,'20 each leg',R(9)], [3,'15',R(9)], [3,'15',R(9)], [3,'10',R(7)]] },
  { tsv: 21, rows: [[3,'4',P(85)], [3,'8-10',R(8)], [3,'6-10',R(7)], [3,'12-15',R(9)], [3,'12',R(9)], [3,'15',R(8)], [3,'6',R(8)]] },
  { tsv: 22, rows: [[2,'15-20',R(5)], [4,'6-8',R(8)], [3,'8-10',R(8)], [3,'10-12',R(9)], [3,'20',R(9)], [3,'20',R(10)], [3,'15',R(10)], [3,'12',R(8)]] },
  { tsv: 22, rows: [[4,'4',P(82.5)], [3,'6-8',P(65)], [3,'20',R(9)], [3,'10-12',R(8)], [3,'15',R(8)], [3,'12',R(8)], [3,'15',R(8)]] },
  { tsv: 21, rows: [[3,'6',P(77.5)], [3,'5',P(82.5)], [3,'10-12',R(8)], [3,'15',R(8)], [3,'8',R(9)], [3,'20',R(9)], [3,'12',R(8)]] },
  { tsv: 24, rows: [[3,'10-12',R(8)], [3,'10',R(8)], [3,'10',R(8)], [3,'15',R(7)], [3,'15',R(8)], [3,'20',R(8)], [3,'12',R(7)], [3,'8',R(7)]] },
]);
// Week 5 — rep ranges shift on Day 1 (4×6) and Day 4 (4×6 deadlift)
weekly[1].push([
  { tsv: 21, rows: [[4,'6',P(72.5)], [3,'10',P(65)], [3,'10-12',R(8)], [2,'20 each leg',R(9)], [3,'15',R(9)], [3,'15',R(9)], [3,'10',R(7)]] },
  { tsv: 23, rows: [[3,'4',P(85)], [3,'8-10',R(8)], [3,'6-10',R(7)], [4,'12-15',R(9)], [4,'12',R(9)], [3,'15',R(8)], [3,'6',R(8)]] },
  { tsv: 22, rows: [[2,'15-20',R(5)], [4,'6-8',R(8)], [3,'8-10',R(8)], [3,'10-12',R(9)], [3,'20',R(9)], [3,'20',R(10)], [3,'15',R(10)], [3,'12',R(8)]] },
  { tsv: 22, rows: [[4,'6',P(72.5)], [3,'6-8',P(67.5)], [3,'20',R(9)], [3,'10-12',R(8)], [3,'15',R(8)], [3,'12',R(8)], [3,'15',R(8)]] },
  { tsv: 23, rows: [[3,'8',P(70)], [3,'6',P(80)], [3,'10-12',R(8)], [4,'15',R(8)], [4,'8',R(9)], [3,'20',R(9)], [3,'12',R(8)]] },
  { tsv: 25, rows: [[4,'10-12',R(8)], [3,'10',R(8)], [3,'10',R(8)], [3,'15',R(7)], [3,'15',R(8)], [3,'20',R(8)], [3,'12',R(7)], [3,'8',R(7)]] },
]);
// Week 6
weekly[1].push([
  { tsv: 21, rows: [[4,'6',P(72.5)], [3,'10',P(65)], [3,'10-12',R(8)], [2,'20 each leg',R(9)], [3,'15',R(9)], [3,'15',R(9)], [3,'10',R(7)]] },
  { tsv: 23, rows: [[3,'4',P(85)], [3,'8-10',R(8)], [3,'6-10',R(7)], [4,'12-15',R(9)], [4,'12',R(9)], [3,'15',R(8)], [3,'6',R(8)]] },
  { tsv: 22, rows: [[2,'15-20',R(5)], [4,'6-8',R(8)], [3,'8-10',R(8)], [3,'10-12',R(9)], [3,'20',R(9)], [3,'20',R(10)], [3,'15',R(10)], [3,'12',R(8)]] },
  { tsv: 22, rows: [[4,'6',P(72.5)], [3,'6-8',P(67.5)], [3,'20',R(9)], [3,'10-12',R(8)], [3,'15',R(8)], [3,'12',R(8)], [3,'15',R(8)]] },
  { tsv: 23, rows: [[3,'8',P(70)], [3,'6',P(80)], [3,'10-12',R(8)], [4,'15',R(8)], [4,'8',R(9)], [3,'20',R(9)], [3,'12',R(8)]] },
  { tsv: 25, rows: [[4,'10-12',R(8)], [3,'10',R(8)], [3,'10',R(8)], [3,'15',R(7)], [3,'15',R(8)], [3,'20',R(8)], [3,'12',R(7)], [3,'8',R(7)]] },
]);
// Week 7
weekly[1].push([
  { tsv: 21, rows: [[4,'6',P(77.5)], [3,'10',P(70)], [3,'10-12',R(8)], [2,'20 each leg',R(9)], [3,'15',R(9)], [3,'15',R(9)], [3,'10',R(7)]] },
  { tsv: 23, rows: [[3,'5',P(82.5)], [3,'8-10',R(8)], [3,'6-10',R(7)], [4,'12-15',R(9)], [4,'12',R(9)], [3,'15',R(8)], [3,'6',R(8)]] },
  { tsv: 22, rows: [[2,'15-20',R(5)], [4,'6-8',R(8)], [3,'8-10',R(8)], [3,'10-12',R(9)], [3,'20',R(9)], [3,'20',R(10)], [3,'15',R(10)], [3,'12',R(8)]] },
  { tsv: 22, rows: [[4,'6',P(80)], [3,'6-8',P(65)], [3,'20',R(9)], [3,'10-12',R(8)], [3,'15',R(8)], [3,'12',R(8)], [3,'15',R(8)]] },
  { tsv: 23, rows: [[3,'8',P(75)], [3,'6',P(82.5)], [3,'10-12',R(8)], [4,'15',R(8)], [4,'8',R(9)], [3,'20',R(9)], [3,'12',R(8)]] },
  { tsv: 25, rows: [[4,'10-12',R(8)], [3,'10',R(8)], [3,'10',R(8)], [3,'15',R(7)], [3,'15',R(8)], [3,'20',R(8)], [3,'12',R(7)], [3,'8',R(7)]] },
]);
// Week 8
weekly[1].push([
  { tsv: 21, rows: [[4,'6',P(82.5)], [3,'10',P(70)], [3,'10-12',R(8)], [2,'20 each leg',R(9)], [3,'15',R(9)], [3,'15',R(9)], [3,'10',R(7)]] },
  { tsv: 23, rows: [[3,'5',P(85)], [3,'8-10',R(8)], [3,'6-10',R(7)], [4,'12-15',R(9)], [4,'12',R(9)], [3,'15',R(8)], [3,'6',R(8)]] },
  { tsv: 22, rows: [[2,'15-20',R(5)], [4,'6-8',R(8)], [3,'8-10',R(8)], [3,'10-12',R(9)], [3,'20',R(9)], [3,'20',R(10)], [3,'15',R(10)], [3,'12',R(8)]] },
  { tsv: 22, rows: [[4,'6',P(82.5)], [3,'6-8',P(65)], [3,'20',R(9)], [3,'10-12',R(8)], [3,'15',R(8)], [3,'12',R(8)], [3,'15',R(8)]] },
  { tsv: 23, rows: [[3,'8',P(80)], [3,'6',P(82.5)], [3,'10-12',R(8)], [4,'15',R(8)], [4,'8',R(9)], [3,'20',R(9)], [3,'12',R(8)]] },
  { tsv: 25, rows: [[4,'10-12',R(8)], [3,'10',R(8)], [3,'10',R(8)], [3,'15',R(7)], [3,'15',R(8)], [3,'20',R(8)], [3,'12',R(7)], [3,'8',R(7)]] },
]);

// --- BLOCK 2 ---
// Week 1 — DELOAD
weekly[2].push([
  { tsv: 14, rows: [[4,'3',P(75)], [2,'6',P(60)], [2,'20',R(7)], [2,'15',R(7)], [2,'12',R(6)], [2,'12',R(6)], [2,'15',R(8)], [2,'8',R(6)]] },
  { tsv: 15, rows: [[2,'8',P(75)], [2,'12',R(7)], [2,'15',R(7)], [2,'15-20',R(8)], [2,'8-10',R(7)], [2,'12-15',R(7)], [2,'12-15',R(7)], [3,'6',R(6)]] },
  { tsv: 16, rows: [[2,'15-20',R(5)], [3,'12',R(7)], [2,'6-8',R(7)], [2,'10-12',R(7)], [2,'12-15',R(8)], [2,'20',R(8)], [2,'12-15',R(8)], [3,'15-20',R(8)]] },
  { tsv: 16, rows: [[3,'4',P(75)], [3,'8',R(7)], [2,'10',R(7)], [2,'12 each leg',R(6)], [2,'15',R(8)], [2,'20',R(8)], [3,'12',R(7)]] },
  { tsv: 17, rows: [[3,'4',P(75)], [3,'4,4',P(72.5)], [2,'8-10',R(6)], [3,'12-15',R(7)], [3,'15-20',R(8)], [3,'30sec',R(7)]] },
  { tsv: 21, rows: [[3,'12',R(7)], [3,'8-10',R(7)], [3,'15-20',R(8)], [3,'15/15',R(7)], [3,'8',R(9)], [3,'8',R(9)], [3,'8',R(9)]] },
]);
// Week 2
weekly[2].push([
  { tsv: 18, rows: [[5,'3',P(80)], [2,'6',P(60)], [2,'20',R(8)], [3,'15',R(9)], [3,'12',R(9)], [3,'12',R(9)], [2,'15',R(8)], [3,'8',R(8)]] },
  { tsv: 15, rows: [[2,'10',P(75)], [2,'12',R(9)], [2,'15',R(9)], [2,'15-20',R(10)], [2,'8-10',R(9)], [2,'12-15',R(8)], [2,'12-15',R(9)], [3,'6',R(7)]] },
  { tsv: 21, rows: [[2,'15-20',R(5)], [3,'12',R(9)], [3,'6-8',R(9)], [3,'10-12',R(9)], [3,'12-15',R(9)], [3,'20',R(9)], [3,'12-15',R(9)], [3,'15-20',R(8)]] },
  { tsv: 18, rows: [[4,'5',P(75)], [3,'8',R(8)], [2,'10',R(9)], [2,'12 each leg',R(8)], [2,'15',R(9)], [2,'20',R(8)], [3,'12',R(8)]] },
  { tsv: 19, rows: [[4,'5',P(75)], [3,'4,4',P(72.5)], [3,'8-10',R(8)], [3,'12-15',R(9)], [3,'15-20',R(9)], [3,'30sec',R(7)]] },
  { tsv: 24, rows: [[3,'12',R(9)], [3,'8-10',R(8)], [3,'15-20',R(9)], [3,'15/15',R(9)], [4,'8',R(10)], [4,'8',R(10)], [4,'8',R(10)]] },
]);
// Week 3
weekly[2].push([
  { tsv: 15, rows: [[5,'3',P(80)], [2,'6',P(65)], [2,'20',R(8)], [2,'15',R(9)], [2,'12',R(9)], [2,'12',R(9)], [2,'15',R(8)], [3,'8',R(8)]] },
  { tsv: 15, rows: [[2,'8',P(77.5)], [2,'12',R(9)], [2,'15',R(9)], [2,'15-20',R(10)], [2,'8-10',R(9)], [2,'12-15',R(8)], [2,'12-15',R(9)], [3,'6',R(7)]] },
  { tsv: 21, rows: [[2,'15-20',R(5)], [3,'12',R(9)], [3,'6-8',R(9)], [3,'10-12',R(9)], [3,'12-15',R(9)], [3,'20',R(9)], [3,'12-15',R(9)], [3,'15-20',R(8)]] },
  { tsv: 18, rows: [[4,'4',P(77.5)], [3,'8',R(8)], [2,'10',R(9)], [2,'12 each leg',R(8)], [2,'15',R(9)], [2,'20',R(8)], [3,'12',R(8)]] },
  { tsv: 19, rows: [[4,'5',P(77.5)], [3,'4,4',P(77.5)], [3,'8-10',R(8)], [3,'12-15',R(9)], [3,'15-20',R(9)], [3,'30sec',R(7)]] },
  { tsv: 24, rows: [[3,'12',R(9)], [3,'8-10',R(8)], [3,'15-20',R(9)], [3,'15/15',R(9)], [4,'8',R(10)], [4,'8',R(10)], [4,'8',R(10)]] },
]);
// Week 4
weekly[2].push([
  { tsv: 15, rows: [[5,'3',P(82.5)], [2,'6',P(65)], [2,'20',R(8)], [2,'15',R(9)], [2,'12',R(9)], [2,'12',R(9)], [2,'15',R(8)], [3,'8',R(8)]] },
  { tsv: 15, rows: [[2,'10',P(77.5)], [2,'12',R(9)], [2,'15',R(9)], [2,'15-20',R(10)], [2,'8-10',R(9)], [2,'12-15',R(8)], [2,'12-15',R(9)], [3,'6',R(7)]] },
  { tsv: 21, rows: [[2,'15-20',R(5)], [3,'12',R(9)], [3,'6-8',R(9)], [3,'10-12',R(9)], [3,'12-15',R(9)], [3,'20',R(9)], [3,'12-15',R(9)], [3,'15-20',R(8)]] },
  { tsv: 18, rows: [[4,'5',P(77.5)], [3,'8',R(8)], [2,'10',R(9)], [2,'12 each leg',R(8)], [2,'15',R(9)], [2,'20',R(8)], [3,'12',R(8)]] },
  { tsv: 19, rows: [[4,'5',P(77.5)], [3,'4,4',P(77.5)], [3,'8-10',R(8)], [3,'12-15',R(9)], [3,'15-20',R(9)], [3,'30sec',R(7)]] },
  { tsv: 24, rows: [[3,'12',R(9)], [3,'8-10',R(8)], [3,'15-20',R(9)], [3,'15/15',R(9)], [4,'8',R(10)], [4,'8',R(10)], [4,'8',R(10)]] },
]);
// Week 5
weekly[2].push([
  { tsv: 15, rows: [[5,'3',P(82.5)], [2,'6',P(67.5)], [2,'20',R(8)], [2,'15',R(9)], [2,'12',R(9)], [2,'12',R(9)], [2,'15',R(8)], [3,'8',R(8)]] },
  { tsv: 15, rows: [[2,'8',P(80)], [2,'12',R(9)], [2,'15',R(9)], [2,'15-20',R(10)], [2,'8-10',R(9)], [2,'12-15',R(8)], [2,'12-15',R(9)], [3,'6',R(7)]] },
  { tsv: 21, rows: [[2,'15-20',R(5)], [3,'12',R(9)], [3,'6-8',R(9)], [3,'10-12',R(9)], [3,'12-15',R(9)], [3,'20',R(9)], [3,'12-15',R(9)], [3,'15-20',R(8)]] },
  { tsv: 18, rows: [[4,'4',P(80)], [3,'8',R(8)], [2,'10',R(9)], [2,'12 each leg',R(8)], [2,'15',R(9)], [2,'20',R(8)], [3,'12',R(8)]] },
  { tsv: 19, rows: [[4,'5',P(80)], [3,'4,4',P(80)], [3,'8-10',R(8)], [3,'12-15',R(9)], [3,'15-20',R(9)], [3,'30sec',R(7)]] },
  { tsv: 24, rows: [[3,'12',R(9)], [3,'8-10',R(8)], [3,'15-20',R(9)], [3,'15/15',R(9)], [4,'8',R(10)], [4,'8',R(10)], [4,'8',R(10)]] },
]);
// Week 6
weekly[2].push([
  { tsv: 15, rows: [[5,'3',P(85)], [2,'6',P(68)], [2,'20',R(8)], [2,'15',R(9)], [2,'12',R(9)], [2,'12',R(9)], [2,'15',R(8)], [3,'8',R(8)]] },
  { tsv: 15, rows: [[2,'10',P(80)], [2,'12',R(9)], [2,'15',R(9)], [2,'15-20',R(10)], [2,'8-10',R(9)], [2,'12-15',R(8)], [2,'12-15',R(9)], [3,'6',R(7)]] },
  { tsv: 21, rows: [[2,'15-20',R(5)], [3,'12',R(9)], [3,'6-8',R(9)], [3,'10-12',R(9)], [3,'12-15',R(9)], [3,'20',R(9)], [3,'12-15',R(9)], [3,'15-20',R(8)]] },
  { tsv: 18, rows: [[4,'5',P(80)], [3,'8',R(8)], [2,'10',R(9)], [2,'12 each leg',R(8)], [2,'15',R(9)], [2,'20',R(8)], [3,'12',R(8)]] },
  { tsv: 19, rows: [[4,'5',P(80)], [3,'4,4',P(80)], [3,'8-10',R(8)], [3,'12-15',R(9)], [3,'15-20',R(9)], [3,'30sec',R(7)]] },
  { tsv: 24, rows: [[3,'12',R(9)], [3,'8-10',R(8)], [3,'15-20',R(9)], [3,'15/15',R(9)], [4,'8',R(10)], [4,'8',R(10)], [4,'8',R(10)]] },
]);
// Week 7
weekly[2].push([
  { tsv: 15, rows: [[5,'3',P(85)], [2,'6',P(70)], [2,'20',R(8)], [2,'15',R(9)], [2,'12',R(9)], [2,'12',R(9)], [2,'15',R(8)], [3,'8',R(8)]] },
  { tsv: 15, rows: [[2,'8',P(82.5)], [2,'12',R(9)], [2,'15',R(9)], [2,'15-20',R(10)], [2,'8-10',R(9)], [2,'12-15',R(8)], [2,'12-15',R(9)], [3,'6',R(7)]] },
  { tsv: 21, rows: [[2,'15-20',R(5)], [3,'12',R(9)], [3,'6-8',R(9)], [3,'10-12',R(9)], [3,'12-15',R(9)], [3,'20',R(9)], [3,'12-15',R(9)], [3,'15-20',R(8)]] },
  { tsv: 18, rows: [[4,'4',P(82.5)], [3,'8',R(8)], [2,'10',R(9)], [2,'12 each leg',R(8)], [2,'15',R(9)], [2,'20',R(8)], [3,'12',R(8)]] },
  { tsv: 19, rows: [[4,'5',P(82.5)], [3,'4,4',P(82.5)], [3,'8-10',R(8)], [3,'12-15',R(9)], [3,'15-20',R(9)], [3,'30sec',R(7)]] },
  { tsv: 24, rows: [[3,'12',R(9)], [3,'8-10',R(8)], [3,'15-20',R(9)], [3,'15/15',R(9)], [4,'8',R(10)], [4,'8',R(10)], [4,'8',R(10)]] },
]);
// Week 8 — testing week (RPE 9 Deadlift; AMRAP Bench)
weekly[2].push([
  { tsv: 15, rows: [[1,'RPE 9 TEST',P(90)], [2,'6',P(70)], [2,'20',R(8)], [2,'15',R(9)], [2,'12',R(9)], [2,'12',R(9)], [2,'15',R(8)], [3,'8',R(8)]] },
  { tsv: 15, rows: [[1,'AMRAP',P(85)], [2,'12',R(9)], [2,'15',R(9)], [2,'15-20',R(10)], [2,'8-10',R(9)], [2,'12-15',R(8)], [2,'12-15',R(9)], [3,'6',R(7)]] },
  { tsv: 21, rows: [[2,'15-20',R(5)], [3,'12',R(9)], [3,'6-8',R(9)], [3,'10-12',R(9)], [3,'12-15',R(9)], [3,'20',R(9)], [3,'12-15',R(9)], [3,'15-20',R(8)]] },
  { tsv: 18, rows: [[4,'5',P(82.5)], [3,'8',R(8)], [2,'10',R(9)], [2,'12 each leg',R(8)], [2,'15',R(9)], [2,'20',R(8)], [3,'12',R(8)]] },
  { tsv: 19, rows: [[4,'5',P(82.5)], [3,'4,4',P(82.5)], [3,'8-10',R(8)], [3,'12-15',R(9)], [3,'15-20',R(9)], [3,'30sec',R(7)]] },
  { tsv: 24, rows: [[3,'12',R(9)], [3,'8-10',R(8)], [3,'15-20',R(9)], [3,'15/15',R(9)], [4,'8',R(10)], [4,'8',R(10)], [4,'8',R(10)]] },
]);

// =============================================================
// EXERCISE SUBSTITUTIONS (PDF pages 96–100).
// Keys match program exercise names (without "A1:"/"A2:" prefixes).
// =============================================================
const substitutions = {
  // Lower body
  'Back Squat':                          ['Hack squat', 'Smith machine squat', 'Leg press + 15 reps of back extensions'],
  'Deadlift':                            ['Trap bar deadlift', 'Romanian deadlift', 'Barbell hip thrust'],
  'Barbell Hip Thrust':                  ['Round-back 45° hyperextension', 'Glute bridge', 'Leg extension machine hip thrust'],
  'Dumbbell Walking Lunge':              ['Bulgarian split squat', 'Reverse lunge', 'Dumbbell step-up', 'Single-leg leg press'],
  'Leg Extension':                       ['Bodyweight squat (20 reps)'],
  'Lying Leg Curl':                      ['Seated leg curl', 'Sliding leg curl', 'Swiss ball leg curl'],
  'Seated Leg Curl':                     ['Lying leg curl', 'Sliding leg curl', 'Swiss ball leg curl'],
  'Standing Calf Raise':                 ['Any calf raise with your knee in the extended position'],
  'Front Squat':                         ['Goblet squat', 'Leg press', 'Bodyweight squat'],
  'Cable Pull Through':                  ['KB swing', 'Dumbbell RDL'],
  'Single-Leg Leg Press':                ['Assisted pistol squat', 'DB step-up'],
  'Single-Leg Leg Extension':            ['Leg extension'],
  'Swiss Ball Single-Leg Leg Curl':      ['Sliding leg curl', 'Seated leg curl', 'Single-leg lying leg curl'],
  'Tempo Back Squat':                    ['Tempo goblet squat', 'Tempo front squat'],
  'Round-Back Dumbbell 45° Hyperextension': ['Barbell hip thrust', 'Straight back 45° hyperextension'],
  'Smith Machine Reverse Lunge':         ['Dumbbell walking lunge', 'Bulgarian split squat'],
  'Enhanced-Eccentric Leg Extension':    ['3-second negative leg extension'],
  'Enhanced-Eccentric Lying Leg Curl':   ['3-second negative lying leg curl'],
  'Lateral Band Walk':                   ['Machine seated hip abduction'],
  'Romanian Deadlift':                   ['Trap bar RDL', 'Cable pull-through', 'Stiff leg deadlift'],
  'Pause Barbell Hip Thrust':            ['Round-back 45° hyperextension', 'Pause glute bridge', 'Pause leg extension machine hip thrust'],
  'Slow Eccentric Goblet Squat':         ['Slow-eccentric bodyweight squat'],
  'Cable Rope Pullthrough':              ['Machine glute kickback'],
  'Tempo Standing Calf Raise':           ['Any calf raise with your knee in the extended position'],

  // Push
  'Barbell Bench Press':                 ['Dumbbell press', 'Machine chest press', 'Smith machine bench press'],
  'Dumbbell Seated Shoulder Press':      ['Arnold press', 'Machine seated shoulder press', 'Seated barbell shoulder press'],
  'Weighted Dip':                        ['Assisted dip', 'Dip machine', 'Bench dip', 'Close-grip bench press', 'Dumbbell floor press'],
  'Low-to-High Cable Flye':              ['Any cable fly which feels natural', 'Pec deck'],
  'Dumbbell Isolateral Skull Crusher':   ['EZ bar skull crusher', 'Single-arm rope triceps extension'],
  'Dumbbell Lateral Raise':              ['Machine lateral raise', 'Resistance band lateral raise', 'Plate lateral raise'],
  'Ab Wheel Rollout':                    ['Long-lever plank', 'Plank', 'Hollow body hold'],
  'Close-Grip Bench Press':              ['Floor press', 'Dumbbell close-grip bench press'],
  'Military Press':                      ['DB standing shoulder press', 'Barbell seated shoulder press'],
  'Dumbbell Incline Press':              ['Barbell incline press', 'Machine incline press'],
  'Pec Deck':                            ['Any cable fly'],
  'Cable Lateral Raise':                 ['Machine lateral raise', 'Resistance band lateral raise', 'Plate lateral raise'],
  'Cable Triceps Kickback':              ['Dumbbell triceps kickback'],
  'Bicycle Crunch':                      ['Ab mat crunch', 'Crunch', 'Cable crunch'],
  'Arnold Press':                        ['DB shoulder press', 'Machine seated shoulder press'],
  'Close-Grip Smith Machine Press':      ['Close-grip bench press', 'Floor press'],
  'Barbell Floor Skull Crusher':         ['EZ bar skull crusher', 'Floor press', 'Pin press', 'JM press'],
  'Egyptian Lateral Raise':              ['Dumbbell lateral raise', 'Cable lateral raise', 'Band lateral raise'],
  'Rope Overhead Triceps Extension':     ['Dumbbell overhead triceps extension'],
  'Hanging Leg Raise':                   ['V-sit up'],
  'Military Press / Push Press Complex': ['Dumbbell shoulder press / push press complex (same thing but with dumbbells)'],
  'Slow Eccentric Dip':                  ['3-second negative assisted dip', '3-second negative bench dip'],
  'Triceps V-Bar Pressdown':             ['Cable triceps pressdown (no attachment on the cable)'],
  'Machine Lateral Raise':               ['Dumbbell seated lateral raise'],
  'Plank':                               ['Hollow body hold', 'Suitcase hold'],

  // Pull
  'Pull-up':                             ['Assisted pull-up', 'Pronated pulldown'],
  'Pendlay Row':                         ['Bent over barbell row', 'One-arm dumbbell row', 'Cable seated row'],
  'Machine High Row':                    ['One-arm dumbbell row', 'Row off of pulldown machine (lean torso back at a 45° angle)'],
  'Seated Face Pull':                    ['Band pull apart', 'Reverse cable flye', 'Reverse pec deck'],
  'Snatch Grip Barbell Shrug':           ['Dumbbell shrug'],
  'Reverse Grip EZ Bar Curl':            ['Pronated dumbbell curl', 'Pronated cable curl'],
  'Supinated EZ Bar Curl':               ['Supinated dumbbell curl', 'Supinated cable curl'],
  'Dumbbell Preacher Curl':              ['Machine preacher curl', 'Dumbbell alternating supinated curl'],
  'Neutral-Grip Pulldown':               ['Single-arm pulldown', 'Supinated pulldown'],
  'Cable Seated Elbows Out Row':         ['Chest-supported T-bar row (wide grip)'],
  'Cable Seated Row':                    ['Chest-supported T-bar row (diagonal grip)'],
  'Kneeling Straight-Arm Cable Pull-Over': ['Standing cable pull-over', 'Dumbbell pull-over'],
  'Dumbbell One-Arm Row':                ['Single-arm cable row'],
  'Chest-Supported T-Bar Row w/ Band':   ['Cable seated row w/ band', 'Enhanced-eccentric chest-supported T-bar row'],
  'Low-to-High Reverse Flye':            ['Low-to-high face pull'],
  'Rope Upright Row':                    ['Low-to-high face pull'],
  'Dumbbell Supinated Curl':             ['EZ bar curl'],
  'Single-Arm Cable Curl':               ['Whichever bicep curl which you feel the most'],
  'Single-Arm Pulldown':                 ['Pulldown'],
  'Seal Row':                            ['Pendlay row', 'Bent over barbell row'],
  'Reverse Pec Deck':                    ['Reverse cable flye'],
  'Cable Reverse Flye':                  ['Reverse pec deck', 'Reverse cable flye'],
  'Hammer Curl':                         ['Whichever hammer-style bicep curl which you feel the most'],
  'Dumbbell Pronated Curl':              ['Pronated dumbbell curl', 'Pronated cable curl'],
  'Dumbbell Hammer Curl':                ['Cable rope hammer curl'],
  'Spider Curl':                         ['Preacher curl', 'Concentration curl'],
  '1 Arm Lat Pull-in':                   ['Straight-arm lat pulldown', 'Cable lat pull-in'],
};

// =============================================================
// BUILD + WRITE
// =============================================================
function build() {
  const blocks = [];
  for (const blockId of [1, 2]) {
    const block = {
      id: blockId,
      name: blockId === 1
        ? 'Block 1 — 8 Week Technique Phase'
        : 'Block 2 — 8 Week Peaking Phase',
      weeks: [],
    };
    for (let w = 1; w <= 8; w++) {
      const isDeload = blockId === 2 && w === 1;
      const week = {
        id: w,
        label: isDeload ? `Week ${w} (Deload)` : `Week ${w}`,
        isDeload,
        days: [],
      };
      for (let d = 1; d <= 6; d++) {
        const template = templates[blockId][d - 1];
        const data = weekly[blockId][w - 1][d - 1];
        if (template.exercises.length !== data.rows.length) {
          throw new Error(`Mismatch B${blockId} W${w} D${d}: template has ${template.exercises.length} exercises but data has ${data.rows.length} rows`);
        }
        week.days.push({
          id: d,
          name: template.name,
          totalSetVolume: data.tsv,
          exercises: template.exercises.map((ex, i) => {
            const [sets, reps, load] = data.rows[i];
            return { ...ex, sets, reps, load };
          }),
        });
      }
      block.weeks.push(week);
    }
    blocks.push(block);
  }
  return {
    title: "Jeff Nippard's Push / Pull / Legs Hypertrophy Program",
    units: 'kg',
    blocks,
    substitutions,
    source: 'JN - Push Pull Legs (Trimmed PDF)',
  };
}

const out = build();
const outPath = path.resolve(__dirname, '..', 'program.json');
fs.writeFileSync(outPath, JSON.stringify(out, null, 2));
console.log(`Wrote ${outPath}`);
console.log(`Blocks: ${out.blocks.length}, Weeks per block: ${out.blocks[0].weeks.length}, Days per week: ${out.blocks[0].weeks[0].days.length}`);
let exTotal = 0;
for (const b of out.blocks) for (const w of b.weeks) for (const d of w.days) exTotal += d.exercises.length;
console.log(`Total exercise rows: ${exTotal}`);
