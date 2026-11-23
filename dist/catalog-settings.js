import { EXERCISES, ROUTINES } from './catalog.js';

export const EXERCISE_GROUPS = ['胸','背中','肩','腕','脚','体幹','有酸素'];
const builtInExercises = new Map(EXERCISES.map(exercise => [exercise.id, exercise]));
const builtInRoutines = new Set(ROUTINES.map(routine => routine.id));

export function getExercises(state) {
  const builtIns = EXERCISES.map(exercise => {
    const edited = state.exerciseOverrides?.[exercise.id];
    if (!edited) return exercise;
    const aliases = edited.name === exercise.name ? exercise.aliases : [...new Set([...exercise.aliases, exercise.name])];
    return {...exercise, name:edited.name, group:edited.group, aliases};
  });
  return [...builtIns, ...state.customExercises];
}

export function getRoutines(state) {
  const builtIns = [];
  for (const routine of ROUTINES) {
    const edited = state.routineOverrides?.[routine.id];
    if (edited !== null) builtIns.push(edited ? {id:routine.id, ...edited} : routine);
  }
  return [...builtIns, ...state.routines];
}

const validName = (value, max) => typeof value === 'string' && value.trim().length > 0 && value.length <= max;
const dictionary = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const onlyKeys = (value, keys) => dictionary(value) && Object.keys(value).every(key => keys.includes(key));

function validRoutineFields(routine, knownIds) {
  return validName(routine.name, 80)
    && typeof routine.subtitle === 'string' && routine.subtitle.length <= 250
    && Array.isArray(routine.exerciseIds) && routine.exerciseIds.length > 0
    && routine.exerciseIds.every(id => knownIds.has(id))
    && new Set(routine.exerciseIds).size === routine.exerciseIds.length;
}

export function validateCatalogOverrides(state, knownIds) {
  if (Object.hasOwn(state, 'exerciseOverrides')) {
    const edits = state.exerciseOverrides;
    if (!dictionary(edits) || !Object.entries(edits).every(([id, edit]) =>
      builtInExercises.has(id) && onlyKeys(edit, ['name','group'])
      && validName(edit.name, 100) && EXERCISE_GROUPS.includes(edit.group))) {
      throw new Error('種目の名前・部位の変更が正しくありません。');
    }
  }
  if (Object.hasOwn(state, 'routineOverrides')) {
    const edits = state.routineOverrides;
    if (!dictionary(edits) || !Object.entries(edits).every(([id, edit]) =>
      builtInRoutines.has(id) && (edit === null ||
        (onlyKeys(edit, ['name','subtitle','exerciseIds']) && validRoutineFields(edit, knownIds))))) {
      throw new Error('既定メニューの変更が正しくありません。');
    }
  }
}

export function editExercise(state, id, {name, group}) {
  const exercises = getExercises(state);
  const exercise = exercises.find(item => item.id === id);
  if (!exercise) throw new Error('種目が見つかりません。');
  const trimmed = typeof name === 'string' ? name.trim() : '';
  const max = trimmed === exercise.name && !builtInExercises.has(id) ? 250 : 100;
  if (!validName(trimmed, max)) throw new Error('種目名を100文字以内で入力してください。');
  if (!EXERCISE_GROUPS.includes(group)) throw new Error('部位を選択してください。');
  if (trimmed !== exercise.name && exercises.some(item => item.id !== id && item.name === trimmed)) {
    throw new Error('同じ名前の種目があります。');
  }
  if (builtInExercises.has(id)) {
    state.exerciseOverrides = {...state.exerciseOverrides, [id]:{name:trimmed, group}};
  } else {
    Object.assign(exercise, {name:trimmed, group});
  }
}

export function saveRoutine(state, {id, name, subtitle = '', exerciseIds}) {
  if (!validName(id, 100)) throw new Error('メニューIDが正しくありません。');
  const edited = {name:typeof name === 'string' ? name.trim() : '', subtitle, exerciseIds};
  const knownIds = new Set(getExercises(state).map(exercise => exercise.id));
  if (!validRoutineFields(edited, knownIds)) {
    throw new Error('メニュー名は80文字以内で入力し、種目を重複せずに1つ以上選んでください。');
  }
  edited.exerciseIds = [...exerciseIds];
  if (builtInRoutines.has(id)) {
    state.routineOverrides = {...state.routineOverrides, [id]:edited};
  } else {
    const index = state.routines.findIndex(routine => routine.id === id);
    if (index < 0) state.routines.push({id, ...edited});
    else state.routines[index] = {id, ...edited};
  }
}

export function deleteRoutine(state, id) {
  if (builtInRoutines.has(id)) {
    state.routineOverrides = {...state.routineOverrides, [id]:null};
  } else {
    state.routines = state.routines.filter(routine => routine.id !== id);
  }
}
