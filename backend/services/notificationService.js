const EventEmitter = require('events');
const logger = require('../utils/logger');

class NotificationService extends EventEmitter {
    constructor() {
        super();
        this.subscribers = new Map();
        this.eventBuffer = new Map();
        this.bufferSize = 100;
        this.setupEventHandlers();
    }

    setupEventHandlers() {
        // Core business events
        this.on('allocation.created', this.handleAllocationEvent.bind(this));
        this.on('allocation.updated', this.handleAllocationEvent.bind(this));
        this.on('allocation.deleted', this.handleAllocationEvent.bind(this));
        
        this.on('banking.created', this.handleBankingEvent.bind(this));
        this.on('banking.updated', this.handleBankingEvent.bind(this));
        this.on('banking.deleted', this.handleBankingEvent.bind(this));
        
        this.on('lapse.created', this.handleLapseEvent.bind(this));
        this.on('lapse.updated', this.handleLapseEvent.bind(this));
        this.on('lapse.deleted', this.handleLapseEvent.bind(this));

        // Error handling
        this.on('error', this.handleError.bind(this));
    }

    async emit(event, data) {
        try {
            logger.info(`[NotificationService] Emitting event: ${event}`, { data });
            super.emit(event, data);

            const subscribers = this.subscribers.get(event) || [];
            await Promise.all(subscribers.map(callback => this.notifySubscriber(callback, data)));
        } catch (error) {
            logger.error('[NotificationService] Error emitting event:', error);
        }
    }

    subscribe(event, callback) {
        if (!this.subscribers.has(event)) {
            this.subscribers.set(event, []);
        }
        this.subscribers.get(event).push(callback);

        logger.info(`[NotificationService] New subscriber for event: ${event}`);
    }

    unsubscribe(event, callback) {
        if (!this.subscribers.has(event)) return;

        const subscribers = this.subscribers.get(event);
        const index = subscribers.indexOf(callback);
        if (index > -1) {
            subscribers.splice(index, 1);
            logger.info(`[NotificationService] Subscriber removed for event: ${event}`);
        }
    }

    async notifySubscriber(callback, data) {
        try {
            await callback(data);
        } catch (error) {
            logger.error('[NotificationService] Error notifying subscriber:', error);
        }
    }

    bufferEvent(eventType, payload) {
        if (!this.eventBuffer.has(eventType)) {
            this.eventBuffer.set(eventType, []);
        }

        const buffer = this.eventBuffer.get(eventType);
        buffer.push({
            timestamp: Date.now(),
            payload
        });

        // Maintain buffer size
        if (buffer.length > this.bufferSize) {
            buffer.shift();
        }
    }

    async handleAllocationEvent(allocation) {
        try {
            this.bufferEvent('allocation', allocation);
            logger.info('Allocation event handled:', allocation);
        } catch (error) {
            this.handleError(error);
        }
    }

    async handleBankingEvent(banking) {
        try {
            this.bufferEvent('banking', banking);
            logger.info('Banking event handled:', banking);
        } catch (error) {
            this.handleError(error);
        }
    }

    async handleLapseEvent(lapse) {
        try {
            this.bufferEvent('lapse', lapse);
            logger.info('Lapse event handled:', lapse);
        } catch (error) {
            this.handleError(error);
        }
    }

    handleError(error) {
        logger.error('Notification Service Error:', {
            message: error.message,
            stack: error.stack
        });
    }

    // Utility methods
    getBufferedEvents(eventType) {
        return this.eventBuffer.get(eventType) || [];
    }

    clearEventBuffer(eventType) {
        if (eventType) {
            this.eventBuffer.delete(eventType);
        } else {
            this.eventBuffer.clear();
        }
    }

    // Event handlers for specific allocation events
    onAllocationCreated(callback) {
        this.subscribe('allocation.created', callback);
    }

    onAllocationUpdated(callback) {
        this.subscribe('allocation.updated', callback);
    }

    onAllocationDeleted(callback) {
        this.subscribe('allocation.deleted', callback);
    }

    onBankingCreated(callback) {
        this.subscribe('banking.created', callback);
    }

    onBankingUpdated(callback) {
        this.subscribe('banking.updated', callback);
    }

    onLapseCreated(callback) {
        this.subscribe('lapse.created', callback);
    }

    onLapseUpdated(callback) {
        this.subscribe('lapse.updated', callback);
    }
}

// Create and export a singleton instance
const notificationService = new NotificationService();
module.exports = notificationService;