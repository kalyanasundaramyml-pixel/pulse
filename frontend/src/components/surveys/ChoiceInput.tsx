import { QuestionOption } from '../../types/api';

export function ChoiceInput({
  options,
  maxChoices,
  selected,
  onChange,
}: {
  options: QuestionOption[];
  maxChoices: number;
  selected: string[];
  onChange: (selected: string[]) => void;
}) {
  const multi = maxChoices > 1;

  function toggle(optionId: string) {
    if (!multi) {
      onChange([optionId]);
      return;
    }
    if (selected.includes(optionId)) {
      onChange(selected.filter((id) => id !== optionId));
      return;
    }
    if (selected.length >= maxChoices) return;
    onChange([...selected, optionId]);
  }

  return (
    <div className="choice-input">
      {options.map((o) => {
        const checked = selected.includes(o.id);
        const disabled = multi && !checked && selected.length >= maxChoices;
        return (
          <label key={o.id} className={`choice-option${disabled ? ' disabled' : ''}`}>
            <input
              type={multi ? 'checkbox' : 'radio'}
              checked={checked}
              disabled={disabled}
              onChange={() => toggle(o.id)}
            />
            {o.label}
          </label>
        );
      })}
    </div>
  );
}
