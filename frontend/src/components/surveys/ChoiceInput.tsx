import { QuestionOption } from '../../types/api';

export function ChoiceInput({
  options,
  multi,
  selected,
  onChange,
}: {
  options: QuestionOption[];
  multi: boolean;
  selected: string[];
  onChange: (selected: string[]) => void;
}) {
  function toggle(optionId: string) {
    if (multi) {
      onChange(selected.includes(optionId) ? selected.filter((id) => id !== optionId) : [...selected, optionId]);
    } else {
      onChange([optionId]);
    }
  }

  return (
    <div className="choice-input">
      {options.map((o) => (
        <label key={o.id} className="choice-option">
          <input
            type={multi ? 'checkbox' : 'radio'}
            checked={selected.includes(o.id)}
            onChange={() => toggle(o.id)}
          />
          {o.label}
        </label>
      ))}
    </div>
  );
}
