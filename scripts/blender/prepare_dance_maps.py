"""Bake rest-space attributes on dance copies for the existing pattern compositor."""
import bpy
from mathutils import Vector
scene=bpy.data.scenes['RA_Dance_Loops'];bpy.context.window.scene=scene;scene.frame_set(1001)
ns=bpy.app.driver_namespace
meshes=[o for o in scene.objects if o.type=='MESH' and not o.hide_render]
if not scene.get('ra_maps_ready'):
    dg=bpy.context.evaluated_depsgraph_get()
    for obj in meshes:
        obj.data=bpy.data.meshes.new_from_object(obj.evaluated_get(dg),preserve_all_data_layers=True,depsgraph=dg)
        obj.modifiers.clear()
    points=[o.matrix_world@v.co for o in meshes for v in o.data.vertices]
    lo=Vector(tuple(min(p[i] for p in points) for i in range(3)))
    hi=Vector(tuple(max(p[i] for p in points) for i in range(3)));center=(lo+hi)/2
    def canonical(p):return Vector((p.x-center.x,p.z-lo.z,-(p.y-center.y)))
    points=[canonical(p) for p in points]
    origin=Vector(tuple(min(p[i] for p in points)-.01 for i in range(3)))
    span=Vector(tuple(max(p[i] for p in points)-origin[i]+.01 for i in range(3)))
    scene['ra_position_origin']=list(origin);scene['ra_position_span']=list(span)
    for obj in meshes:
        pos=obj.data.attributes.get('ra_position') or obj.data.attributes.new('ra_position','FLOAT_VECTOR','POINT')
        normal=obj.data.attributes.get('ra_normal') or obj.data.attributes.new('ra_normal','FLOAT_VECTOR','CORNER')
        for v in obj.data.vertices:
            p=canonical(obj.matrix_world@v.co);pos.data[v.index].vector=tuple((p[i]-origin[i])/span[i] for i in range(3))
        nm=obj.matrix_world.to_3x3().inverted().transposed()
        for face in obj.data.polygons:
            n=(nm@face.normal).normalized()
            for i in face.loop_indices:normal.data[i].vector=((n.x+1)/2,(n.z+1)/2,(-n.y+1)/2)
    scene['ra_maps_ready']=True
ns['ra_dance_base']={o.name:tuple(o.data.materials) for o in meshes}
print('Rest-space maps prepared on',len(meshes),'owned meshes')
