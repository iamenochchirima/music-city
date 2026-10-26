import { useRef } from "react";
import { Upload } from "lucide-react";
import { Button } from "./button";

export function AudioFilePicker({
  label = "Upload audio from device",
  inputLabel,
  multiple,
  disabled,
  onFiles,
  id,
  ...aria
}: {
  label?: string;
  inputLabel: string;
  multiple?: boolean;
  disabled?: boolean;
  onFiles: (files: File[]) => void;
  id?: string;
  "aria-describedby"?: string;
  "aria-invalid"?: boolean;
}) {
  const input = useRef<HTMLInputElement>(null);
  return (
    <>
      {/* A generic file picker keeps audio with missing mobile MIME associations selectable. */}
      <input
        ref={input}
        id={id}
        type="file"
        aria-label={inputLabel}
        multiple={multiple}
        disabled={disabled}
        className="sr-only"
        tabIndex={-1}
        {...aria}
        onChange={(event) => {
          const files = Array.from(event.currentTarget.files ?? []);
          event.currentTarget.value = "";
          if (files.length) onFiles(files);
        }}
      />
      <Button
        type="button"
        disabled={disabled}
        onClick={() => input.current?.click()}
      >
        <Upload className="size-4" />
        {label}
      </Button>
    </>
  );
}
