// Werid dependendy for chatgpt library
import './fetch-polyfill.js'
import {Options} from './options.js'
import * as core from '@actions/core'
import {
  ChatGPTAPI,
  ChatMessage,
  SendMessageOptions,
} from 'chatgpt'


export class Bot {
  private turbo: ChatGPTAPI | null = null // not free
  private history: ChatMessage | null = null
  private MAX_PATCH_COUNT: number = 4000

  private options: Options

  constructor(options: Options) {
    this.options = options
    if (process.env.OPENAI_API_KEY) {
      this.turbo = new ChatGPTAPI({
        apiKey: process.env.OPENAI_API_KEY,
        debug: options.debug,
        completionParams: {
          model: 'gpt-4o',
          // temperature: 0.5,
          // top_p: 0.8
        }
        // assistantLabel: " ",
        // userLabel: " ",
      })
    } else {
      const err =
        "Unable to initialize the chatgpt API, " +
        "'OPENAI_API_KEY' environment variable are not available"
      throw new Error(err)
    }
  }

  public chat = async (action: string, message: string, initial = false) => {
    console.time(`chatgpt ${action} ${message.length} tokens cost`)
    let response = null
    try {
      response = await this.chat_(action, message, initial)
    } catch (e: any) {
      core.warning(`Failed to chat: ${e}, backtrace: ${e.stack}`)
    } finally {
      console.timeEnd(`chatgpt ${action} ${message.length} tokens cost`)
      return response
    }
  }

  private chat_ = async (action: string, message: string, initial = false) => {
    if (!message) {
      return ''
    }
    if (message.length > this.MAX_PATCH_COUNT) {
      core.warning(
        `Message is too long, truncate to ${this.MAX_PATCH_COUNT} tokens`
      )
      message = message.substring(0, this.MAX_PATCH_COUNT)
    }
    if (this.options.debug) {
      core.info(`sending to chatgpt: ${message}`)
    }

    let response: ChatMessage | null = null
    if (this.turbo) {
      let opts: SendMessageOptions = {}
      if (this.history && !initial) {
        opts.parentMessageId = this.history.id
      }
      response = await this.turbo.sendMessage(message, opts)
      try {
        core.info(`response: ${JSON.stringify(response)}`)
      } catch (e: any) {
        core.info(
          `response: ${response}, failed to stringify: ${e}, backtrace: ${e.stack}`
        )
      }
    } else {
      core.setFailed('The chatgpt API is not initialized')
    }
    let response_text = ''
    if (response) {
      if (initial) {
        this.history = response
      }
      response_text = response.text
    } else {
      core.warning('chatgpt response is null')
    }
    // remove the prefix "with " in the response
    if (response_text.startsWith('with ')) {
      response_text = response_text.substring(5)
    }
    if (this.options.debug) {
      core.info(`chatgpt responses: ${response_text}`)
    }
    return response_text
  }
}
