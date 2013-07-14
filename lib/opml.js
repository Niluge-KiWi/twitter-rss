var XML = require('xml');

function OPML(options, outlines) {
  options = options || {};

  this.title    = options.title || 'Untitled OPML Document';
  this.outlines = outlines || [];
};

function Outline(options, outlines) {
  options = options || {};

  this.text     = options.text;
  this.title    = options.title;
  this.htmlUrl  = options.htmlUrl;
  this.type     = options.type;
  this.xmlUrl   = options.xmlUrl;
  this.outlines = outlines || [];
};

OPML.Outline = Outline;

OPML.prototype.outline = function (outline) {
  if (!(outline instanceof Outline)) {
    var options = outline;
    outline = new Outline(options);
  }
  this.outlines.push(outline);
  return outline;
}

Outline.prototype.outline = OPML.prototype.outline;

OPML.prototype.xml = function (indent) {
  return '<?xml version="1.0" encoding="UTF-8"?>\n' + XML(this._generateXML(), indent);
};

OPML.prototype._generateXML = function () {
  var outlines = [];
  this.outlines.forEach(function (outline) {
    outlines.push(outline._generateXML());
  });
  return {
    opml: [
      { _attr: { version: '1.0' } },
      { head: { title: this.title } },
      { body: outlines }
  ] };
};


Outline.prototype._generateXML = function () {
  var outline = [];
  var attr = {};
  if (this.text    ) attr.text    = this.text;
  if (this.title   ) attr.title   = this.title;
  if (this.htmlUrl ) attr.htmlUrl = this.htmlUrl;
  if (this.type    ) attr.type    = this.type;
  if (this.xmlUrl  ) attr.xmlUrl  = this.xmlUrl;

  outline.push({ _attr: attr });

  this.outlines.forEach(function (childOutline) {
    outline.push(childOutline._generateXML());
  });

  return {
    outline: outline
  };
};


module.exports = OPML;
