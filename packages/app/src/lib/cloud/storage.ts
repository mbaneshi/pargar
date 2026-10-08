import { getClientLazy } from './supabase';

const BUCKET = 'nexus';

export interface ProjectMetadata {
  id: string;
  name: string;
  ownerId: string;
  ownerEmail: string;
  createdAt: Date;
  updatedAt: Date;
  entityCount: number;
  layerCount: number;
}

export class CloudStorageService {
  async saveProject(
    userId: string,
    userEmail: string,
    projectId: string,
    name: string,
    json: string,
    entityCount: number,
    layerCount: number,
  ): Promise<void> {
    const client = getClientLazy();
    if (!client) throw new Error('Cloud features unavailable — Supabase not configured');

    const { error: uploadError } = await client.storage
      .from(BUCKET)
      .upload(`projects/${userId}/${projectId}.json`, json, {
        contentType: 'application/json',
        upsert: true,
      });
    if (uploadError) throw uploadError;

    const { error: dbError } = await client.schema('nexus').from('projects').upsert({
      id: projectId,
      name,
      owner_id: userId,
      owner_email: userEmail,
      updated_at: new Date().toISOString(),
      entity_count: entityCount,
      layer_count: layerCount,
    });
    if (dbError) throw dbError;
  }

  async loadProject(userId: string, projectId: string): Promise<string> {
    const client = getClientLazy();
    if (!client) throw new Error('Cloud features unavailable — Supabase not configured');

    const { data, error } = await client.storage
      .from(BUCKET)
      .download(`projects/${userId}/${projectId}.json`);
    if (error) throw error;
    return data.text();
  }

  async listProjects(userId: string): Promise<ProjectMetadata[]> {
    const client = getClientLazy();
    if (!client) throw new Error('Cloud features unavailable — Supabase not configured');

    const { data, error } = await client
      .schema('nexus')
      .from('projects')
      .select('*')
      .eq('owner_id', userId)
      .order('updated_at', { ascending: false });
    if (error) throw error;

    return (data ?? []).map((row) => ({
      id: row.id,
      name: row.name,
      ownerId: row.owner_id,
      ownerEmail: row.owner_email ?? '',
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
      entityCount: row.entity_count ?? 0,
      layerCount: row.layer_count ?? 0,
    }));
  }

  async deleteProject(userId: string, projectId: string): Promise<void> {
    const client = getClientLazy();
    if (!client) throw new Error('Cloud features unavailable — Supabase not configured');

    const { error: storageError } = await client.storage
      .from(BUCKET)
      .remove([`projects/${userId}/${projectId}.json`]);
    if (storageError) throw storageError;

    const { error: dbError } = await client
      .schema('nexus')
      .from('projects')
      .delete()
      .eq('id', projectId);
    if (dbError) throw dbError;
  }

  async exportDxfToCloud(userId: string, projectId: string, dxfString: string): Promise<string> {
    const client = getClientLazy();
    if (!client) throw new Error('Cloud features unavailable — Supabase not configured');

    const path = `exports/${userId}/${projectId}.dxf`;
    const { error: uploadError } = await client.storage
      .from(BUCKET)
      .upload(path, dxfString, { contentType: 'application/dxf', upsert: true });
    if (uploadError) throw uploadError;

    const { data, error: signError } = await client.storage
      .from(BUCKET)
      .createSignedUrl(path, 3600);
    if (signError) throw signError;
    return data.signedUrl;
  }
}
