import { NextResponse } from 'next/server';
import { createClient, createAdminClient, isSupabaseConfigured } from '@/lib/supabase/server';
import { getAuthenticatedUserRole } from '@/lib/auth';
import { supabaseMock } from '@/lib/supabase';
import { PortalLink, sanitizeLinkUrl, resolveLinkId } from '@/lib/links';

/**
 * GET /api/links
 * Retrieves bio links securely from the portal_links database table.
 * Committee accounts receive all links (including inactive), while public visitors receive only active links.
 */
export async function GET() {
  try {
    let isCommittee = false;

    if (isSupabaseConfigured()) {
      try {
        const userClient = await createClient();
        const { data: { user } } = await userClient.auth.getUser();
        if (user) {
          const role = await getAuthenticatedUserRole(userClient, user);
          isCommittee = role >= 1;
        }
      } catch {
        // Fall through as public visitor
      }

      const admin = createAdminClient();
      let query = admin
        .from('portal_links')
        .select('*')
        .order('sort_order', { ascending: true });

      if (!isCommittee) {
        query = query.eq('is_active', true);
      }

      const { data, error } = await query;
      if (error) throw error;
      return NextResponse.json({ links: data || [] });
    } else {
      // Mock provider fallback
      const { data } = await supabaseMock.from('portal_links').select<PortalLink>();
      const list = data || [];
      const filtered = isCommittee ? list : list.filter(l => l.is_active);
      return NextResponse.json({ links: filtered });
    }
  } catch (err: any) {
    return NextResponse.json(
      { links: [], error: err.message },
      { status: 500 }
    );
  }
}

/**
 * POST /api/links
 * Creates a new bio link card securely in the database (Role >= 1).
 */
export async function POST(request: Request) {
  try {
    if (isSupabaseConfigured()) {
      const userClient = await createClient();
      const { data: { user } } = await userClient.auth.getUser();
      if (!user) {
        return NextResponse.json(
          { error: 'Unauthorized: Authentication required' },
          { status: 401 }
        );
      }
      const role = await getAuthenticatedUserRole(userClient, user);

      if (role < 1) {
        return NextResponse.json(
          { error: 'Forbidden: Committee access required to manage links' },
          { status: 403 }
        );
      }
    }

    const body = await request.json().catch(() => ({}));
    const title = (body.title || '').trim();
    const rawUrl = (body.url || '').trim();

    if (!title || !rawUrl) {
      return NextResponse.json(
        { error: 'Link title and URL are required' },
        { status: 400 }
      );
    }

    const newLink = {
      title,
      url: sanitizeLinkUrl(rawUrl),
      subtitle: (body.subtitle || '').trim() || null,
      icon: (body.icon || '').trim() || '🔗',
      sort_order: Number.isInteger(body.sort_order) ? body.sort_order : 10,
      is_active: body.is_active !== false,
      is_highlighted: Boolean(body.is_highlighted),
    };

    if (isSupabaseConfigured()) {
      const admin = createAdminClient();
      const { data, error } = await admin
        .from('portal_links')
        .insert(newLink)
        .select()
        .single();

      if (error) throw error;
      return NextResponse.json({ link: data, success: true }, { status: 201 });
    } else {
      const { data } = await supabaseMock.from('portal_links').insert(newLink);
      return NextResponse.json({ link: data?.[0] || newLink, success: true }, { status: 201 });
    }
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Failed to create link' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/links
 * Updates an existing link in the database (Role >= 1).
 */
export async function PATCH(request: Request) {
  try {
    if (isSupabaseConfigured()) {
      const userClient = await createClient();
      const { data: { user } } = await userClient.auth.getUser();
      if (!user) {
        return NextResponse.json(
          { error: 'Unauthorized: Authentication required' },
          { status: 401 }
        );
      }
      const role = await getAuthenticatedUserRole(userClient, user);

      if (role < 1) {
        return NextResponse.json(
          { error: 'Forbidden: Committee access required to update links' },
          { status: 403 }
        );
      }
    }

    const body = await request.json().catch(() => ({}));
    const rawId = body.id;
    if (!rawId) {
      return NextResponse.json({ error: 'Link id is required' }, { status: 400 });
    }
    const id = resolveLinkId(String(rawId));

    const updates: Partial<PortalLink> = {};
    if (body.title !== undefined) updates.title = body.title.trim();
    if (body.url !== undefined) updates.url = sanitizeLinkUrl(body.url);
    if (body.subtitle !== undefined) updates.subtitle = body.subtitle ? body.subtitle.trim() : null;
    if (body.icon !== undefined) updates.icon = body.icon.trim() || '🔗';
    if (body.sort_order !== undefined) updates.sort_order = Number(body.sort_order);
    if (body.is_active !== undefined) updates.is_active = Boolean(body.is_active);
    if (body.is_highlighted !== undefined) updates.is_highlighted = Boolean(body.is_highlighted);
    updates.updated_at = new Date().toISOString();

    if (isSupabaseConfigured()) {
      const admin = createAdminClient();
      const { data, error } = await admin
        .from('portal_links')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return NextResponse.json({ link: data, success: true });
    } else {
      const { data } = await supabaseMock.from('portal_links').update(updates).eq('id', id);
      return NextResponse.json({ link: data?.[0], success: true });
    }
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Failed to update link' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/links
 * Removes a link securely from the database (Role >= 1).
 */
export async function DELETE(request: Request) {
  try {
    if (isSupabaseConfigured()) {
      const userClient = await createClient();
      const { data: { user } } = await userClient.auth.getUser();
      if (!user) {
        return NextResponse.json(
          { error: 'Unauthorized: Authentication required' },
          { status: 401 }
        );
      }
      const role = await getAuthenticatedUserRole(userClient, user);

      if (role < 1) {
        return NextResponse.json(
          { error: 'Forbidden: Committee access required to delete links' },
          { status: 403 }
        );
      }
    }

    const { searchParams } = new URL(request.url);
    let rawId = searchParams.get('id');
    if (!rawId) {
      const body = await request.json().catch(() => ({}));
      rawId = body.id;
    }

    if (!rawId) {
      return NextResponse.json({ error: 'Link id is required' }, { status: 400 });
    }
    const id = resolveLinkId(String(rawId));

    if (isSupabaseConfigured()) {
      const admin = createAdminClient();
      const { error } = await admin
        .from('portal_links')
        .delete()
        .eq('id', id);

      if (error) throw error;
      return NextResponse.json({ success: true });
    } else {
      await supabaseMock.from('portal_links').delete().eq('id', id);
      return NextResponse.json({ success: true });
    }
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Failed to delete link' },
      { status: 500 }
    );
  }
}
