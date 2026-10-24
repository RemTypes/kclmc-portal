import { NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth/server';
import { memberRoster } from '@/lib/roster/service';

/**
 * GET /api/roster
 * Fetches the entire KCLSU membership roster joined with safety contacts (Role >= 1).
 */
export async function GET(request: Request): Promise<NextResponse>;
export async function GET(): Promise<NextResponse>;
export async function GET(request?: Request): Promise<NextResponse> {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user || user.role < 1) {
      return NextResponse.json(
        { error: 'Unauthorized: Committee access required to view membership roster' },
        { status: 403 }
      );
    }

    const data = await memberRoster.listRoster();
    return NextResponse.json(data);
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to fetch roster' }, { status: 500 });
  }
}

/**
 * POST /api/roster
 * Ingests and synchronizes KCLSU roster sales records OR creates a manual Associate Member (Role >= 1).
 */
export async function POST(request: Request) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user || user.role < 1) {
      return NextResponse.json(
        { error: 'Unauthorized: Committee access required to synchronize roster' },
        { status: 403 }
      );
    }

    const body = await request.json().catch(() => ({}));

    // Handle manual Associate Member creation
    if (body.action === 'create_associate') {
      const outcome = await memberRoster.createAssociateMember({
        fullName: body.fullName || '',
        tier: body.tier === 'recreational' ? 'recreational' : 'social',
        email: body.email || null,
        university: body.university || null,
        customCardNumber: body.customCardNumber || null,
        suStatus: body.suStatus || 'awaiting_su',
        transactionId: body.transactionId || null,
      });

      if (!outcome.success) {
        return NextResponse.json({ error: outcome.error }, { status: 400 });
      }

      return NextResponse.json({
        success: true,
        member: outcome.member,
        message: `Created Associate Member ${outcome.member?.name} (${outcome.member?.cardNumber}).`,
      });
    }

    const input = body.csv || body.records || [];
    const outcome = await memberRoster.syncRoster(input);

    if (!outcome.success) {
      return NextResponse.json({ error: outcome.error }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      source: outcome.source,
      message: `Successfully synchronized ${outcome.totalSynced} members to database.`,
      totalSynced: outcome.totalSynced,
      records: outcome.records,
    });
  } catch (err: any) {
    console.error('Roster sync error:', err);
    return NextResponse.json({ error: err.message || 'Failed to sync roster' }, { status: 500 });
  }
}

/**
 * PATCH /api/roster
 * Manually edits a member's full name, tier, SU status, email, or university in the roster (Role >= 1).
 */
export async function PATCH(request: Request) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user || user.role < 1) {
      return NextResponse.json(
        { error: 'Unauthorized: Committee access required to edit member roster' },
        { status: 403 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const { cardNumber, fullName, tier, email, university, suStatus } = body;

    if (!cardNumber || typeof cardNumber !== 'string') {
      return NextResponse.json(
        { error: 'Invalid payload: cardNumber is required' },
        { status: 400 }
      );
    }

    // Legacy name-only update path
    const hasExtendedUpdates = tier !== undefined || email !== undefined || university !== undefined || suStatus !== undefined;
    if (!hasExtendedUpdates) {
      if (!fullName || typeof fullName !== 'string') {
        return NextResponse.json(
          { error: 'Invalid payload: cardNumber and fullName are required' },
          { status: 400 }
        );
      }
      const outcome = await memberRoster.updateMemberName(cardNumber, fullName);
      if (!outcome.success) {
        return NextResponse.json({ error: outcome.error }, { status: 400 });
      }
      return NextResponse.json({
        success: true,
        message: `Successfully updated member name for ${cardNumber.toUpperCase()} to ${fullName.trim()}.`,
        cardNumber: cardNumber.toUpperCase(),
        fullName: fullName.trim(),
      });
    }

    const outcome = await memberRoster.updateRosterMember(cardNumber, {
      fullName: typeof fullName === 'string' ? fullName : undefined,
      tier: tier === 'recreational' || tier === 'social' ? tier : undefined,
      email: email !== undefined ? email : undefined,
      university: university !== undefined ? university : undefined,
      suStatus: suStatus === 'verified' || suStatus === 'awaiting_su' || suStatus === 'revoked' ? suStatus : undefined,
    });

    if (!outcome.success) {
      return NextResponse.json({ error: outcome.error }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      message: `Successfully updated roster record for ${cardNumber.toUpperCase()}.`,
      cardNumber: cardNumber.toUpperCase(),
      member: outcome.member,
    });
  } catch (err: any) {
    console.error('Roster update error:', err);
    return NextResponse.json({ error: err.message || 'Failed to update member record' }, { status: 500 });
  }
}

/**
 * DELETE /api/roster
 * Deletes a roster/associate member record by cardNumber (Role >= 1).
 */
export async function DELETE(request: Request) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user || user.role < 1) {
      return NextResponse.json(
        { error: 'Unauthorized: Committee access required to delete roster member' },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    let cardNumber = searchParams.get('cardNumber');
    if (!cardNumber) {
      const body = await request.json().catch(() => ({}));
      cardNumber = body.cardNumber;
    }

    if (!cardNumber || typeof cardNumber !== 'string') {
      return NextResponse.json(
        { error: 'Invalid payload: cardNumber is required' },
        { status: 400 }
      );
    }

    const outcome = await memberRoster.deleteRosterMember(cardNumber);
    if (!outcome.success) {
      return NextResponse.json({ error: outcome.error }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      cardNumber: cardNumber.toUpperCase(),
      message: `Removed ${cardNumber.toUpperCase()} from the roster.`,
    });
  } catch (err: any) {
    console.error('Roster delete error:', err);
    return NextResponse.json({ error: err.message || 'Failed to delete roster member' }, { status: 500 });
  }
}

