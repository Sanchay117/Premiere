/** Bump when the capture format changes, so saved captures are taken again. */
export const CAPTURE_VERSION = 2;

export type ElementKind = "link" | "button" | "input" | "textarea" | "select" | "checkbox" | "tab" | "other";
export type Region = "header" | "nav" | "main" | "footer" | "aside" | "dialog" | "other";

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface CapturedElement {
  /** Stable id like "e12". Plans refer to elements by this id. */
  id: string;
  kind: ElementKind;
  /** Visible label, aria-label or placeholder, at most 80 characters. */
  text: string;
  role: string | null;
  inputType: string | null;
  href: string | null;
  /** Link that loads another page. */
  navigates: boolean;
  /** Link to a different site. */
  external: boolean;
  region: Region;
  /** Page coordinates in CSS pixels at a 1920x1080 viewport. */
  box: Box;
  aboveFold: boolean;
  /** CSS path the recorder uses to find the element again on a fresh page load. */
  selector: string;
  /** Password, email, payment and similar fields. Never typed into. */
  sensitive: boolean;
}

export interface CapturedSection {
  /** Stable id like "s3". Plans may scroll to a section. */
  id: string;
  heading: string;
  level: number;
  /** Text that follows the heading, at most 220 characters. */
  text: string;
  y: number;
}

export interface CapturedScreenshot {
  /** Clean full-size viewport screenshot (1920x1080 JPEG). */
  file: string;
  /** Downscaled copy with element and section ids drawn on, sent to the planner. */
  markedFile: string;
  scrollY: number;
  width: number;
  height: number;
}

export interface Capture {
  version: typeof CAPTURE_VERSION;
  url: string;
  finalUrl: string;
  capturedAt: string;
  title: string;
  description: string;
  siteName: string;
  lang: string;
  ogImage: string | null;
  themeColor: string | null;
  /** Visible text, one line per block, deduplicated, at most 2500 characters. */
  textExcerpt: string;
  pageHeight: number;
  viewport: { width: number; height: number };
  /** A visible password field: stay on public content. */
  loginWall: boolean;
  /** Looks like a bot-protection or access-denied page. */
  botWall: boolean;
  elements: CapturedElement[];
  sections: CapturedSection[];
  screenshots: CapturedScreenshot[];
  /** What the capture did, such as dismissing a cookie banner. */
  notes: string[];
  warnings: string[];
}

/** A capture plus the directory holding its screenshots. */
export interface StoredCapture {
  capture: Capture;
  dir: string;
}
