export type TRole = "user" | "assistant";

export type TVersionRole = { id: string; content: string };

export type TMessage = {
  key: string;
  from: TRole;
  versions?: TVersionRole[];
  content?: string;
  attachments?: {
    id: string;
    type: "file";
    url: string;
    mediaType: string;
    filename?: string;
  }[];
};
