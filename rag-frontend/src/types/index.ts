export type TRole = "user" | "assistant";

export type TSource = { id: string; title: string; pages: number[] };

export type TVersionRole = {
  id: string;
  content: string;
  sources?: TSource[];
};

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
