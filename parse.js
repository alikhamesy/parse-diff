module.exports = (input) => {
  if (!input) return [];
  if (typeof input !== "string" || input.match(/^\s+$/)) return [];

  const lines = input.split("\n");
  if (lines.length === 0) return [];

  const files = [];
  let currentFile = null;
  let currentChunk = null;
  let deletedLineCounter = 0;
  let addedLineCounter = 0;

  const normal = (line) => {
    currentChunk?.changes.push({
      type: "normal",
      normal: true,
      ln1: deletedLineCounter++,
      ln2: addedLineCounter++,
      content: line,
    });
  };

  const start = (line) => {
    const [fromFileName, toFileName] = parseFiles(line) ?? [];

    currentFile = {
      chunks: [],
      deletions: 0,
      additions: 0,
      from: fromFileName,
      to: toFileName,
    };

    files.push(currentFile);
  };

  const restart = () => {
    if (!currentFile || currentFile.chunks.length) start();
  };

  const newFile = () => {
    restart();
    currentFile.new = true;
    currentFile.from = "/dev/null";
  };

  const deletedFile = () => {
    restart();
    currentFile.deleted = true;
    currentFile.to = "/dev/null";
  };

  const index = (line) => {
    restart();
    currentFile.index = line.split(" ").slice(1);
  };

  const fromFile = (line) => {
    restart();
    currentFile.from = parseOldOrNewFile(line);
  };

  const toFile = (line) => {
    restart();
    currentFile.to = parseOldOrNewFile(line);
  };

  const chunk = (line, match) => {
    if (!currentFile) return;

    const [oldStart, oldNumLines, newStart, newNumLines] = match.slice(1);

    deletedLineCounter = +oldStart;
    addedLineCounter = +newStart;
    currentChunk = {
      content: line,
      changes: [],
      oldStart: +oldStart,
      oldLines: +(oldNumLines || 1),
      newStart: +newStart,
      newLines: +(newNumLines || 1),
    };
    currentFile.chunks.push(currentChunk);
  };

  const del = (line) => {
    if (!currentChunk) return;

    currentChunk.changes.push({
      type: "del",
      del: true,
      ln: deletedLineCounter++,
      content: line,
    });
    currentFile.deletions++;
  };

  const add = (line) => {
    if (!currentChunk) return;

    currentChunk.changes.push({
      type: "add",
      add: true,
      ln: addedLineCounter++,
      content: line,
    });
    currentFile.additions++;
  };

  const eof = (line) => {
    if (!currentChunk) return;

    const [mostRecentChange] = currentChunk.changes.slice(-1);

    currentChunk.changes.push({
      type: mostRecentChange.type,
      [mostRecentChange.type]: true,
      ln1: mostRecentChange.ln1,
      ln2: mostRecentChange.ln2,
      ln: mostRecentChange.ln,
      content: line,
    });
  };

  const schema = [
    // TODO: better regexp to avoid detect normal line starting with diff
    [/^\s+/, normal],
    [/^diff\s/, start],
    [/^new file mode \d+$/, newFile],
    [/^deleted file mode \d+$/, deletedFile],
    [/^index\s[\da-zA-Z]+\.\.[\da-zA-Z]+(\s(\d+))?$/, index],
    [/^---\s/, fromFile],
    [/^\+\+\+\s/, toFile],
    [/^@@\s+-(\d+),?(\d+)?\s+\+(\d+),?(\d+)?\s@@/, chunk],
    [/^-/, del],
    [/^\+/, add],
    [/^\\ No newline at end of file$/, eof],
  ];

  const parseLine = (line) => {
    for (const [pattern, handler] of schema) {
      const match = line.match(pattern);
      if (match) {
        handler(line, match);
        return true;
      }
    }
    return false;
  };

  for (const line of lines) parseLine(line);

  return files;
};

const fileNameDiffRegex = /a\/.*(?=["']? ["']?b\/)|b\/.*$/g;
const parseFiles = (line) => {
  let fileNames = line?.match(fileNameDiffRegex);
  return fileNames?.map((fileName) =>
    fileName.replace(/^(a|b)\//, "").replace(/("|')$/, "")
  );
};

const parseOldOrNewFile = (line) => {
  let fileName = leftTrimChars(line, "-+").trim();
  fileName = removeTimeStamp(fileName);
  return /^(a|b)\//.test(fileName) ? fileName.substr(2) : fileName;
};

const leftTrimChars = (string, trimmingChars) => {
  string = makeString(string);
  if (!trimmingChars && String.prototype.trimLeft) return string.trimLeft();

  let trimmingString = formTrimmingString(trimmingChars);

  return string.replace(new RegExp(`^${trimmingString}+`), "");
};

const timeStampRegex = /\t.*|\d{4}-\d\d-\d\d\s\d\d:\d\d:\d\d(.\d+)?\s(\+|-)\d\d\d\d/;
const removeTimeStamp = (string) => {
  const timeStamp = timeStampRegex.exec(string);
  if (timeStamp) {
    string = string.substring(0, timeStamp.index).trim();
  }
  return string;
};

const formTrimmingString = (trimmingChars) => {
  if (trimmingChars === null || trimmingChars === undefined) return "\\s";
  else if (trimmingChars instanceof RegExp) return trimmingChars.source;
  return `[${makeString(trimmingChars).replace(
    /([.*+?^=!:${}()|[\]/\\])/g,
    "\\$1"
  )}]`;
};

const makeString = (itemToConvert) => (itemToConvert ?? "") + "";
