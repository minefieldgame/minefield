export type ShareResultStatus = "shared" | "copied" | "cancelled" | "failed";

function legacyCopy(text: string) {
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.select();
  const copied = document.execCommand("copy");
  textarea.remove();
  return copied;
}

export async function shareResult(text: string): Promise<ShareResultStatus> {
  if (typeof navigator.share === "function") {
    try {
      await navigator.share({ title: "Minefield Daily", text });
      return "shared";
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return "cancelled";
    }
  }

  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return "copied";
    }
    return legacyCopy(text) ? "copied" : "failed";
  } catch {
    return legacyCopy(text) ? "copied" : "failed";
  }
}

export async function copyResultText(text: string): Promise<"copied" | "failed"> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return "copied";
    }
    return legacyCopy(text) ? "copied" : "failed";
  } catch {
    return legacyCopy(text) ? "copied" : "failed";
  }
}
