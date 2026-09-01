/**
 * HITL Notifier
 * 
 * Multi-channel notification system for approval requests.
 * Supports console, webhook, email, and custom handlers.
 */

/**
 * Notification channels
 */
export const NotificationChannel = {
  CONSOLE: 'console',
  WEBHOOK: 'webhook',
  EMAIL: 'email',
  CUSTOM: 'custom',
};

/**
 * Notifier - Sends approval notifications via multiple channels
 */
export class Notifier {
  constructor(config = {}) {
    this.channels = new Map();
    this.defaultChannels = config.defaultChannels || [NotificationChannel.CONSOLE];
    
    // Register built-in channels
    this.registerChannel(NotificationChannel.CONSOLE, this.notifyConsole.bind(this));
    
    if (config.webhookUrl) {
      this.registerChannel(NotificationChannel.WEBHOOK, this.notifyWebhook.bind(this, config.webhookUrl));
    }
    
    if (config.emailConfig) {
      this.registerChannel(NotificationChannel.EMAIL, this.notifyEmail.bind(this, config.emailConfig));
    }
    
    // Register custom channels
    if (config.customChannels) {
      for (const [name, handler] of Object.entries(config.customChannels)) {
        this.registerChannel(name, handler);
      }
    }
  }

  /**
   * Register a notification channel
   */
  registerChannel(name, handler) {
    this.channels.set(name, handler);
  }

  /**
   * Unregister a channel
   */
  unregisterChannel(name) {
    this.channels.delete(name);
  }

  /**
   * Send notification to all configured channels
   */
  async notify(approval, channels = this.defaultChannels) {
    const results = [];
    
    for (const channel of channels) {
      const handler = this.channels.get(channel);
      if (handler) {
        try {
          await handler(approval);
          results.push({ channel, success: true });
        } catch (error) {
          results.push({ channel, success: false, error: error.message });
        }
      } else {
        results.push({ channel, success: false, error: 'Channel not registered' });
      }
    }
    
    return results;
  }

  /**
   * Console notification (built-in)
   */
  async notifyConsole(approval) {
    const status = approval.status === 'pending' ? '⏳ PENDING' : 
                   approval.status === 'approved' ? '✅ APPROVED' : 
                   approval.status === 'rejected' ? '❌ REJECTED' : '⏰ EXPIRED';
    
    console.log(`
╔══════════════════════════════════════════════════════════════╗
║  HITL Approval ${status.padEnd(50)}║
╠══════════════════════════════════════════════════════════════╣
║  ID:        ${approval.id.padEnd(50)}║
║  Action:    ${approval.action.padEnd(50)}║
║  Requester: ${approval.requester.padEnd(50)}║
║  Status:    ${status.padEnd(50)}║
║  Created:   ${new Date(approval.createdAt).toLocaleString().padEnd(50)}║
${approval.expiresAt ? `║  Expires:   ${new Date(approval.expiresAt).toLocaleString().padEnd(50)}║` : ''}
${approval.context ? `║  Context:   ${JSON.stringify(approval.context).substring(0, 48).padEnd(50)}║` : ''}
╚══════════════════════════════════════════════════════════════╝
    `);
  }

  /**
   * Webhook notification (built-in)
   */
  async notifyWebhook(webhookUrl, approval) {
    const payload = {
      type: 'hitl_approval',
      approval: {
        id: approval.id,
        action: approval.action,
        context: approval.context,
        requester: approval.requester,
        status: approval.status,
        createdAt: approval.createdAt,
        expiresAt: approval.expiresAt,
      },
      timestamp: new Date().toISOString(),
    };
    
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    
    if (!response.ok) {
      throw new Error(`Webhook failed: ${response.status} ${response.statusText}`);
    }
  }

  /**
   * Email notification (built-in - requires email service)
   */
  async notifyEmail(emailConfig, approval) {
    // This is a placeholder - integrate with actual email service
    // Example: SendGrid, Mailgun, AWS SES, etc.
    console.log(`[EMAIL] Would send approval notification to ${emailConfig.to}`);
    console.log(`Subject: [LSJI] Approval ${approval.status}: ${approval.action}`);
    console.log(`Body: Approval ${approval.id} requires your attention`);
  }
}

/**
 * Create notifier from config
 */
export function createNotifier(config = {}) {
  return new Notifier(config);
}
