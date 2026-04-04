import DOMPurify from 'dompurify';

const ALLOWED_TAGS = [
  'b', 'strong', 'i', 'em', 'u', 'del', 's', 'a', 'p', 'br', 'code',
  'pre', 'blockquote', 'ul', 'ol', 'li', 'h1', 'h2', 'h3', 'h4', 'h5',
  'h6', 'span', 'hr', 'table', 'thead', 'tbody', 'tr', 'th', 'td',
];

const ALLOWED_ATTR = [
  'href', 'class', 'rel',
  'data-mx-bg-color', 'data-mx-color', 'data-mx-spoiler', 'color',
];

type FormattedMessageProps = {
  formattedBody: string;
};

export function FormattedMessage({ formattedBody }: FormattedMessageProps) {
  const sanitized = DOMPurify.sanitize(formattedBody, {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
    FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onmouseover', 'onfocus'],
    FORBID_TAGS: ['style', 'form', 'input', 'textarea', 'button', 'select'],
  });

  return (
    <span
      className="formatted-message"
      // Sanitized by DOMPurify before render — safe to use dangerouslySetInnerHTML
      // eslint-disable-next-line react/no-danger
      dangerouslySetInnerHTML={{ __html: sanitized }}
    />
  );
}
