	return [] if input.match /^\s+$/

	lines = input.split '\n'
	return [] if lines.length == 0
	ln_del = 0
	ln_add = 0
	new_file = ->
		file.new = true
	index = (line) ->
		file.index = line.split(' ').slice(1)
	from_file = (line) ->
		file.from = parseFile line
	to_file = (line) ->
		restart()
		file.to = parseFile line

	chunk = (line, match) ->
		ln_del = +match[1]
		ln_add = +match[3]
		file.lines.push {type:'chunk', chunk:true, content:line}
	del = (line) ->
		file.lines.push {type:'del', del:true, ln:ln_del++, content:line}
	add = (line) ->
		file.lines.push {type:'add', add:true, ln:ln_add++, content:line}
	noeol = '\\ No newline at end of file'
	normal = (line) ->
		file.lines.push {
			type: 'normal'
			normal: true
			ln1: ln_del++ unless line is noeol
			ln2: ln_add++ unless line is noeol
			content: line
		}
		# todo beter regexp to avoid detect normal line starting with diff
		[/^new file mode \d+$/, new_file],
		[/^index\s[\da-zA-Z]+\.\.[\da-zA-Z]+(\s(\d+))?$/, index],
		[/^@@\s+\-(\d+),(\d+)\s+\+(\d+),(\d+)\s@@/, chunk],
	parse = (line) ->
		for p in schema
			m = line.match p[0]
			if m
				p[1](line, m)
				return true
		return false

	for line in lines
		normal(line) unless parse line