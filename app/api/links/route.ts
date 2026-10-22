import { NextResponse } from 'next/server';
import { createClient, createAdminClient, isSupabaseConfigured } from '@/lib/supabase/server';
import { getAuthenticatedUserRole } from '@/lib/auth';
import { supabaseMock } from '@/lib/supabase';
import { DEFAULT_PORTAL_LINKS, PortalLink, sanitizeLinkUrl, resolveLinkId, isValidUuid } from '@/lib/links';

/**
 * GET /api/links
 * Retrieves bio links for /links.
 * Committee accounts receive all links (including inactive), while public visitors receive only active links.
 * When portal_links is empty in Supabase, automatically seeds the default links using the admin client.
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

      try {
        const admin = createAdminClient();
        let query = admin
          .from('portal_links')
          .select('*')
          .order('sort_order', { ascending: true });

        if (!isCommittee) {
          query = query.eq('is_active', true);
        }

        const { data, error } = await query;
        if (!error && Array.isArray(data) && data.length > 0) {
          return NextResponse.json({ links: data });
        }

        // If table has 0 rows, auto-seed with default links
        if (!error && Array.isArray(data) && data.length === 0) {
          try {
            const seedRows = DEFAULT_PORTAL_LINKS.map(link => ({
              id: link.id,
              title: link.title,
              url: link.url,
              subtitle: link.subtitle,
              icon: link.icon,
              sort_order: link.sort_order,
              is_active: link.is_active,
              is_highlighted: link.is_highlighted,
            }));
            const { data: seeded, error: seedError } = await admin
              .from('portal_links')
              .insert(seedRows)
              .select();

            if (!seedError && Array.isArray(seeded) && seeded.length > 0) {
              const result = isCommittee ? seeded : seeded.filter(l => l.is_active);
              return NextResponse.json({ links: result });
            }
          } catch (seedErr) {
            console.warn('Auto-seed portal_links failed:', seedErr);
          }
        }
      } catch (err) {
        console.warn('portal_links table fetch failed, falling back to defaults:', err);
      }
    } else {
      // Mock provider fallback
      const { data } = await supabaseMock.from('portal_links').select<PortalLink>();
      if (Array.isArray(data) && data.length > 0) {
        const filtered = isCommittee ? data : data.filter(l => l.is_active);
        return NextResponse.json({ links: filtered });
      }
    }

    // Default static fallback
    return NextResponse.json({
      links: DEFAULT_PORTAL_LINKS,
    });
  } catch (err: any) {
    return NextResponse.json(
      { links: DEFAULT_PORTAL_LINKS, error: err.message },
      { status: 200 } // Gracefully return defaults even on unexpected exceptions
    );
  }
}

/**
 * POST /api/links
 * Creates a new bio link card in the directory (Role >= 1).
 * Uses createAdminClient to ensure RLS does not block legitimate committee operations.
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
 * Updates an existing link card or toggle properties (Role >= 1).
 * Supports both database UUIDs and legacy default link IDs.
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

      // Check if target link exists in database
      const { data: existing } = await admin
        .from('portal_links')
        .select('*')
        .eq('id', id)
        .maybeSingle();

      if (!existing) {
        // If row is a built-in default link that hasn't been seeded yet, materialize it with updates applied
        const defaultLink = DEFAULT_PORTAL_LINKS.find(l => l.id === id);
        if (defaultLink) {
          const toInsert = {
            id: defaultLink.id,
            title: updates.title ?? defaultLink.title,
            url: updates.url ?? defaultLink.url,
            subtitle: updates.subtitle !== undefined ? updates.subtitle : defaultLink.subtitle,
            icon: updates.icon ?? defaultLink.icon,
            sort_order: updates.sort_order ?? defaultLink.sort_order,
            is_active: updates.is_active !== undefined ? updates.is_active : defaultLink.is_active,
            is_highlighted: updates.is_highlighted !== undefined ? updates.is_highlighted : defaultLink.is_highlighted,
          };
          const { data: inserted, error: insertError } = await admin
            .from('portal_links')
            .insert(toInsert)
            .select()
            .single();

          if (insertError) throw insertError;
          return NextResponse.json({ link: inserted, success: true });
        }
      }

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
 * Removes a link from the directory (Role >= 1).
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

      // Check if this was the first action on an unseeded table
      const { count } = await admin
        .from('portal_links')
        .select('*', { count: 'exact', head: true });

      if (count === 0) {
        // Seed the other default links (excluding the one being deleted)
        const othersToSeed = DEFAULT_PORTAL_LINKS
          .filter(l => l.id !== id)
          .map(l => ({
            id: l.id,
            title: l.title,
            url: l.url,
            subtitle: l.subtitle,
            icon: l.icon,
            sort_order: l.sort_order,
            is_active: l.is_active,
            is_highlighted: l.is_highlighted,
          }));
        await admin.from('portal_links').insert(othersToSeed);
        return NextResponse.json({ success: true });
      }

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
