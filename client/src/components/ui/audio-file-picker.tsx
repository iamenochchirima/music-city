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
      {/* Extensions keep audio selectable when mobile MIME metadata is missing. */}
      <input
        ref={input}
        id={id}
        type="file"
        accept=".mp3,.wav,.wave,.flac,.m4a,.aac,.ogg,.oga,audio/*"
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
