class BaseError extends Error {
    constructor(message, statusCode = 500) {
        super(message);
        this.name = this.constructor.name;
        this.statusCode = statusCode;
        Error.captureStackTrace(this, this.constructor);
    }
}

class ValidationError extends BaseError {
    constructor(message) {
        super(message, 400);
    }
}

class DatabaseError extends BaseError {
    constructor(message) {
        super(message, 500);
    }
}

class NotFoundError extends BaseError {
    constructor(message) {
        super(message, 404);
    }
}

class ConflictError extends BaseError {
    constructor(message) {
        super(message, 409);
    }
}

module.exports = {
    BaseError,
    ValidationError,
    DatabaseError,
    NotFoundError,
    ConflictError
};