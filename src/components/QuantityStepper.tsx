type Props = {
  value: number;
  max: number;
  label: string; // used for screen readers, e.g. the product name
  onChange: (next: number) => void;
};

export default function QuantityStepper({ value, max, label, onChange }: Props) {
  return (
    <div className="stepper" role="group" aria-label={`Quantity for ${label}`}>
      <button type="button" onClick={() => onChange(value - 1)} disabled={value <= 1} aria-label={`Decrease quantity of ${label}`}>
        −
      </button>
      <span aria-live="polite" aria-label={`Quantity ${value}`}>{value}</span>
      <button type="button" onClick={() => onChange(value + 1)} disabled={value >= max} aria-label={`Increase quantity of ${label}`}>
        +
      </button>
    </div>
  );
}
