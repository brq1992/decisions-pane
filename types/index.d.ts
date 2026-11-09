export type Option = { key: string; label: string; detail?: string }
export type Decision = {
  id: string
  title: string
  detail?: string
  options: Option[]
  recommend?: string
  why?: string
  blocks?: string
}
export type Todo = { id: string; title: string; detail?: string; path?: string; doc?: string; waiting?: boolean }
export type Progress = { who: string; what: string }
export type Decided = { date: string; text: string }
export type Board = {
  updated: string
  /** The pane's headline. */
  title: string
  /** Who answers the buttons: the assistant's name, shown as the one the answer goes to. */
  assistant: string
  /** name -> emoji drawn before that name. */
  avatars: Record<string, string>
  decide: Decision[]
  todo: Todo[]
  inProgress: Progress[]
  decided: Decided[]
}
/** id of a decision -> what the person sent for it, until the file drops that id */
export type Sent = Record<string, string>

