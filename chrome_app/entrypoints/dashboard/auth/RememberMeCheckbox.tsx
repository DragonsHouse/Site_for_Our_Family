import { DragonCheckbox } from '../dragon-ui/dragon-ui';

export function RememberMeCheckbox({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <DragonCheckbox
      checked={checked}
      label="Запам'ятати мене"
      onCheckedChange={onChange}
    />
  );
}
