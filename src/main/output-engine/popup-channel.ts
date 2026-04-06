export class TextPopupChannel {
  private lastMessage = ''
  private readonly publish: (message: string) => void

  constructor(publish: (message: string) => void) {
    this.publish = publish
  }

  show(message: string): void {
    this.lastMessage = message
    this.publish(message)
  }

  getLastMessage(): string {
    return this.lastMessage
  }
}
