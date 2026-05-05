import sys, json
from graphify.extract import collect_files, extract
from pathlib import Path

with open('.graphify_detect.json') as f:
    detect_data = json.load(f)

code_files = []
for fp in detect_data.get('files', {}).get('code', []):
    p = Path(fp)
    if p.is_dir():
        code_files.extend(collect_files(p))
    else:
        code_files.append(p)

if code_files:
    result = extract(code_files)
    with open('.graphify_ast.json', 'w') as f:
        json.dump(result, f, indent=2)
    node_count = len(result['nodes'])
    edge_count = len(result['edges'])
    print(f'AST: {node_count} nodes, {edge_count} edges')
else:
    with open('.graphify_ast.json', 'w') as f:
        json.dump({'nodes':[],'edges':[],'input_tokens':0,'output_tokens':0}, f)
    print('No code files - skipping AST extraction')
