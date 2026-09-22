class HttpError extends Error {
  constructor(status, message, details) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
    if (details !== undefined) {
      this.details = details;
    }
  }
}

const badRequest = (message, details) => new HttpError(400, message, details);
const notFound = (message = '记录不存在') => new HttpError(404, message);

module.exports = {
  HttpError,
  badRequest,
  notFound,
};
