export type ServiceCreateInFlight = { current: boolean };

export function beginServiceCreate(state: ServiceCreateInFlight) {
  if (state.current) return false;
  state.current = true;
  return true;
}

export function finishServiceCreate(state: ServiceCreateInFlight) {
  state.current = false;
}
