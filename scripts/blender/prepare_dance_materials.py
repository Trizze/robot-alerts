import bpy
def material(kind):
    name = 'RA_DanceMap_' + kind
    mat = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    mat.use_nodes = True
    tree = mat.node_tree
    tree.nodes.clear()
    output = tree.nodes.new('ShaderNodeOutputMaterial')
    if kind == 'holdout':
        node = tree.nodes.new('ShaderNodeHoldout')
    elif kind == 'shade':
        node = tree.nodes.new('ShaderNodeBsdfPrincipled')
        node.inputs['Base Color'].default_value = (1, 1, 1, 1)
        node.inputs['Roughness'].default_value = .72
    else:
        node = tree.nodes.new('ShaderNodeEmission')
        attr = tree.nodes.new('ShaderNodeAttribute')
        attr.attribute_name = 'ra_normal' if kind == 'normal' else 'ra_position'
        value = attr.outputs['Vector']
        if kind in ['high', 'low']:
            def vector_math(operation, x, y=None):
                n = tree.nodes.new('ShaderNodeVectorMath')
                n.operation = operation
                tree.links.new(x, n.inputs[0])
                if y is not None:
                    n.inputs[1].default_value = (y, y, y)
                return n.outputs[0]
            value = vector_math('MULTIPLY', value, 4095)
            value = vector_math('FLOOR', value)
            if kind == 'high':
                value = vector_math('DIVIDE', value, 16)
                value = vector_math('FLOOR', value)
                value = vector_math('DIVIDE', value, 255)
            else:
                value = vector_math('MODULO', value, 16)
                value = vector_math('DIVIDE', value, 15)
        tree.links.new(value, node.inputs['Color'])
    tree.links.new(node.outputs[0], output.inputs['Surface'])
    return mat

for kind in ['holdout','high','low','normal','shade']:
    material(kind)
m=bpy.data.materials.get('RA_Dance_WhiteMask') or bpy.data.materials.new('RA_Dance_WhiteMask')
m.use_nodes=True;m.node_tree.nodes.clear()
out=m.node_tree.nodes.new('ShaderNodeOutputMaterial');white=m.node_tree.nodes.new('ShaderNodeEmission')
white.inputs['Color'].default_value=(1,1,1,1);m.node_tree.links.new(white.outputs[0],out.inputs['Surface'])
print('Dance render materials ready')
