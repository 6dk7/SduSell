import { cloneElement, useId } from 'react';

// Label + input + optional hint. The label is wired to the input automatically.
export function Field({ label, hint, children }) {
  const id = useId();
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      {cloneElement(children, { id })}
      {hint ? <p className="hint">{hint}</p> : null}
    </div>
  );
}

export function CitySelect({ cities, blankLabel = 'Choose a city', withBlank = true, ...props }) {
  return (
    <select name="city" {...props}>
      {withBlank ? <option value="">{blankLabel}</option> : null}
      {cities.map((c) => <option key={c} value={c}>{c}</option>)}
    </select>
  );
}
